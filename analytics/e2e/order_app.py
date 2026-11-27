"""Test-only composition: real Order service, fixed customer, no external IdP."""

import asyncio

import main
from fastapi import FastAPI
from internal.adapter.http.auth import current_subject


def application(**kwargs):
    app = FastAPI(**kwargs)
    app.dependency_overrides[current_subject] = lambda: "analytics-e2e"
    return app


main.FastAPI = application
asyncio.run(main.run())
