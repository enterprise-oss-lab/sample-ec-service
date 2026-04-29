FROM golang:1.25-alpine AS builder
RUN apk add --no-cache gcc musl-dev librdkafka-dev pkgconf
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -tags musl -o /inventory ./main.go

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /inventory /inventory
EXPOSE 8080
ENTRYPOINT ["/inventory"]
