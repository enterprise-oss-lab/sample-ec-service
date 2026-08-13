// ec-traffic.js — sample-ec-service 向けリアルなデモトラフィック生成 (k6)
//
// 目的:
//   order / inventory の HTTP API を「閲覧多め・購入少なめ」の EC 的ミックスで叩き、
//   Grafana ダッシュボード「EC Overview (sample-ec-service)」の全パネルを自然な値で動かす。
//   意図的にエラー (在庫切れ→failed / 不正body→422 / 存在しないID→404) を混ぜ、
//   SLO・可用性・ビジネス成功率のパネルがリアルな 100% 未満の値になるようにする。
//
// 前提:
//   docker compose up --build -d でスタックが起動済みであること。
//   本スクリプトはホストから localhost の公開ポート (order=8081 / inventory=18081) を叩く。
//
// 実行例:
//   k6 run k6/ec-traffic.js
//   k6 run -e PURCHASE_RPS=8 -e BROWSE_RPS=20 k6/ec-traffic.js
//   k6 run -e ORDER_URL=http://localhost:8081 -e INVENTORY_URL=http://localhost:18081 k6/ec-traffic.js
//
// 実行中に Grafana <http://localhost:3000> の「EC Overview」を開くと各パネルが埋まる。

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// --- 設定 (環境変数で上書き可。既定は compose のホストポートに一致) ---
const ORDER_URL = (__ENV.ORDER_URL || 'http://localhost:8081').replace(/\/+$/, '');
const INVENTORY_URL = (__ENV.INVENTORY_URL || 'http://localhost:18081').replace(/\/+$/, '');

const BROWSE_RPS = Number(__ENV.BROWSE_RPS || 12); // 閲覧のピーク到着レート (req/s)
const PURCHASE_RPS = Number(__ENV.PURCHASE_RPS || 4); // 注文のピーク到着レート (req/s)
const RESTOCK_RPS = Number(__ENV.RESTOCK_RPS || 2); // 在庫補充の到着レート (req/s)

// 在庫 seed の id (services/inventory/db/migrations/002_seed_inventories.sql)
const INVENTORY_IDS = [1, 2, 3, 4, 5];
// 在庫を確実に超過させる固定 qty。restock で在庫が積み上がっても常に超過するため、
// saga 経由で確定的に reservation failure → order failed を発生させられる。
const OVERSELL_QTY = 1000000;

// --- カスタムメトリクス (k6 の終了サマリを読みやすくする。ダッシュボードはサーバ側指標を参照) ---
const ordersCreated = new Counter('ec_orders_created');
const ordersOversold = new Counter('ec_orders_oversold');
const ordersRejected422 = new Counter('ec_orders_rejected_422');
const orderCreateLatency = new Trend('ec_order_create_latency', true);

// 既定では 2xx を「期待どおり」とみなす。意図的な 4xx はリクエスト個別に上書きする
// (下の responseCallback)。これにより http_req_failed は「意図しない 5xx / タイムアウト」だけを拾う。
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }));

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const options = {
  setupTimeout: '30s',
  scenarios: {
    // 閲覧: EC のトラフィックの大半。ミニセッション (一覧→商品→注文履歴) を think time 付きで模擬。
    browse: {
      executor: 'ramping-arrival-rate',
      exec: 'browse',
      startRate: Math.max(1, Math.round(BROWSE_RPS / 3)),
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 120,
      stages: [
        { target: BROWSE_RPS, duration: '2m' }, // ramp up
        { target: BROWSE_RPS, duration: '4m' }, // sustain
        { target: Math.round(BROWSE_RPS * 1.6), duration: '1m' }, // 緩やかなスパイク
        { target: BROWSE_RPS, duration: '2m' }, // 戻す
        { target: Math.max(1, Math.round(BROWSE_RPS / 3)), duration: '2m' }, // ramp down
      ],
    },
    // 購入: 閲覧より低レート。80% 正常 / 12% 在庫超過 / 8% 不正body。
    purchase: {
      executor: 'ramping-arrival-rate',
      exec: 'purchase',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 80,
      stages: [
        { target: PURCHASE_RPS, duration: '2m' },
        { target: PURCHASE_RPS, duration: '4m' },
        { target: Math.round(PURCHASE_RPS * 1.6), duration: '1m' },
        { target: PURCHASE_RPS, duration: '2m' },
        { target: 1, duration: '2m' },
      ],
    },
    // 補充: 正常注文の成功予約で減る在庫を継続補充し、自然枯渇 (全 failed 化) を防ぐ。
    restock: {
      executor: 'constant-arrival-rate',
      exec: 'restock',
      rate: RESTOCK_RPS,
      timeUnit: '1s',
      duration: '11m', // ramping シナリオの総尺 (2+4+1+2+2) に合わせる
      preAllocatedVUs: 5,
      maxVUs: 20,
    },
  },
  thresholds: {
    // 意図しない失敗 (5xx / タイムアウト) のみを対象にする
    http_req_failed: ['rate<0.02'],
    checks: ['rate>0.98'],
    'http_req_duration{endpoint:POST /orders}': ['p(95)<1500'],
  },
};

// 起動確認: 両サービスに疎通しているか軽くチェックし、落ちていれば警告する。
export function setup() {
  const inv = http.get(`${INVENTORY_URL}/inventories`, { tags: { endpoint: 'GET /inventories' } });
  const ord = http.get(`${ORDER_URL}/orders`, { tags: { endpoint: 'GET /orders' } });
  if (inv.status !== 200) {
    console.warn(`inventory (${INVENTORY_URL}) に疎通できません (status=${inv.status})。docker compose の起動を確認してください。`);
  }
  if (ord.status !== 200) {
    console.warn(`order (${ORDER_URL}) に疎通できません (status=${ord.status})。docker compose の起動を確認してください。`);
  }
}

// 閲覧セッション: 一覧 → 商品詳細 (時々 404) → 時々 注文履歴。
export function browse() {
  let res = http.get(`${INVENTORY_URL}/inventories`, { tags: { endpoint: 'GET /inventories' } });
  check(res, { 'list inventories 200': (r) => r.status === 200 });
  sleep(randInt(3, 9) / 10); // 0.3〜0.9s の think time

  if (Math.random() < 0.05) {
    // 存在しない商品を閲覧 → 404 (閲覧可用性を 100% 未満にする)
    res = http.get(`${INVENTORY_URL}/inventories/9999`, {
      tags: { endpoint: 'GET /inventories/{id}', intended_error: 'true' },
      responseCallback: http.expectedStatuses(404),
    });
    check(res, { 'missing product 404': (r) => r.status === 404 });
  } else {
    const id = pick(INVENTORY_IDS);
    res = http.get(`${INVENTORY_URL}/inventories/${id}`, { tags: { endpoint: 'GET /inventories/{id}' } });
    check(res, { 'get product 200': (r) => r.status === 200 });
  }
  sleep(randInt(3, 12) / 10);

  if (Math.random() < 0.4) {
    res = http.get(`${ORDER_URL}/orders`, { tags: { endpoint: 'GET /orders' } });
    check(res, { 'list orders 200': (r) => r.status === 200 });
  }
}

// 購入: 重み付きで正常 / 在庫超過 / 不正body に分岐。
export function purchase() {
  const r = Math.random();
  if (r < 0.08) {
    createInvalidOrder(); // ~8%: 422
    return;
  }
  const oversell = r < 0.2; // ~12%: 在庫超過 (0.08〜0.20)
  createOrder(oversell);
}

function createOrder(oversell) {
  const items = [
    { inventory_id: pick(INVENTORY_IDS), quantity: oversell ? OVERSELL_QTY : randInt(1, 3) },
  ];
  // 時々 2 商品目を足す (order は先頭 item のみ予約するが、リクエストのリアルさのため)
  if (Math.random() < 0.3) {
    items.push({ inventory_id: pick(INVENTORY_IDS), quantity: randInt(1, 2) });
  }
  const payload = JSON.stringify({ customer_id: `user-${randInt(1, 500)}`, items });

  const res = http.post(`${ORDER_URL}/orders`, payload, {
    headers: JSON_HEADERS,
    tags: { endpoint: 'POST /orders' },
  });
  orderCreateLatency.add(res.timings.duration);
  const ok = check(res, { 'create order 201': (r) => r.status === 201 });
  if (!ok) {
    return;
  }
  ordersCreated.add(1);
  if (oversell) {
    ordersOversold.add(1);
  }

  const order = res.json();
  const orderId = order && order.id;
  if (!orderId) {
    return;
  }

  sleep(randInt(4, 12) / 10);

  // 作成直後の確認 (注文詳細の閲覧)
  if (Math.random() < 0.6) {
    const got = http.get(`${ORDER_URL}/orders/${orderId}`, { tags: { endpoint: 'GET /orders/{id}' } });
    check(got, { 'get order 200': (r) => r.status === 200 });
  }

  // まれにキャンセル。pending のうちなら 204 (cancelled 遷移)、既に confirmed 済みなら 422。
  if (!oversell && Math.random() < 0.1) {
    const cancelled = http.post(`${ORDER_URL}/orders/${orderId}/cancel`, null, {
      tags: { endpoint: 'POST /orders/{id}/cancel', intended_error: 'true' },
      responseCallback: http.expectedStatuses(204, 422),
    });
    check(cancelled, { 'cancel 204/422': (r) => r.status === 204 || r.status === 422 });
  }
}

function createInvalidOrder() {
  // 空 items もしくは quantity<=0 → FastAPI/ドメインバリデーションで 422
  const bad =
    Math.random() < 0.5
      ? { customer_id: `user-${randInt(1, 500)}`, items: [] }
      : { customer_id: `user-${randInt(1, 500)}`, items: [{ inventory_id: pick(INVENTORY_IDS), quantity: 0 }] };

  const res = http.post(`${ORDER_URL}/orders`, JSON.stringify(bad), {
    headers: JSON_HEADERS,
    tags: { endpoint: 'POST /orders', intended_error: 'true' },
    responseCallback: http.expectedStatuses(422),
  });
  const ok = check(res, { 'invalid order 422': (r) => r.status === 422 });
  if (ok) {
    ordersRejected422.add(1);
  }
}

// 在庫補充: 成功予約で減った在庫を継続的に戻す。pgx DB オペレーションパネルにも寄与。
export function restock() {
  const id = pick(INVENTORY_IDS);
  const payload = JSON.stringify({ quantity: randInt(30, 80) });
  const res = http.post(`${INVENTORY_URL}/inventories/${id}/restock`, payload, {
    headers: JSON_HEADERS,
    tags: { endpoint: 'POST /inventories/{id}/restock' },
  });
  check(res, { 'restock 204': (r) => r.status === 204 });
}
