# Learn-Hub

> **Học Viện AI Nhí** — Nền tảng học tập tương tác giúp trẻ em khám phá Trí Tuệ Nhân Tạo (AI) thông qua camera, trò chơi cử chỉ tay và nhận diện khuôn mặt.

## Tổng Quan

Learn-Hub là một ứng dụng full-stack monorepo gồm **2 service chính** được triển khai bằng Docker Compose:

| Service | Công nghệ | Mô tả |
|---------|-----------|-------|
| **Client** | Next.js 16 · React 19 · Tailwind CSS 4 | Giao diện web tương tác cho trẻ em |
| **Server** | NestJS 11 · TypeORM · PostgreSQL | REST API backend với Swagger docs |

Ngoài ra, hệ thống còn sử dụng:
- **PostgreSQL 15** — Cơ sở dữ liệu chính
- **Redis (Alpine)** — Cache layer

## Kiến Trúc Hệ Thống

```
Learn-Hub/
├── client/              # Next.js 16 frontend (port 3000)
│   ├── src/
│   │   ├── app/         # App Router (pages, layouts)
│   │   ├── components/  # UI components tái sử dụng
│   │   └── lib/         # Utilities & helpers
│   └── Dockerfile
│
├── server/              # NestJS 11 backend (port 3001)
│   ├── src/
│   │   ├── shared/      # Config, Database, Guards
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── Dockerfile
│
└── docker-compose.yml   # Orchestration cho toàn bộ services
```

## Yêu Cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (bao gồm Docker Compose)
- [Node.js 20+](https://nodejs.org/) (nếu chạy local không dùng Docker)

## Khởi Chạy Nhanh

### Với Docker Compose (khuyến nghị)

```bash
# Clone repo
git clone https://github.com/PhucAn04/Learn-Hub.git
cd Learn-Hub

# Khởi chạy toàn bộ services
docker-compose up -d --build
```

Sau khi chạy xong:

| Service | URL |
|---------|-----|
| 🌐 Client (Next.js) | http://localhost:3000 |
| 🔧 Server API | http://localhost:3001 |
| 📖 Swagger Docs | http://localhost:3001/api/docs |
| 🗄️ PostgreSQL | `localhost:5433` |
| ⚡ Redis | `localhost:6380` |

### Chạy Local (không Docker)

```bash
# Terminal 1 — Server
cd server
cp .env.example .env
npm install
npm run start:dev

# Terminal 2 — Client
cd client
npm install
npm run dev
```

> **Lưu ý:** Khi chạy local, bạn cần có PostgreSQL và Redis đang chạy sẵn (hoặc chỉ chạy db + redis qua Docker).

## Scripts Hữu Ích

### Client (`/client`)

| Script | Lệnh | Mô tả |
|--------|-------|-------|
| `npm run dev` | `next dev` | Chạy dev server (Turbopack) |
| `npm run dev:clean` | Xóa `.next` → `next dev` | Chạy dev sau khi xóa cache |
| `npm run build` | `next build` | Build production |
| `npm run lint` | `eslint` | Kiểm tra code style |

### Server (`/server`)

| Script | Lệnh | Mô tả |
|--------|-------|-------|
| `npm run start:dev` | `nest start --watch` | Chạy dev server (watch mode) |
| `npm run build` | `nest build` | Build production |
| `npm run test` | `jest` | Chạy unit tests |
| `npm run migration:run` | TypeORM migration | Chạy database migrations |

## Tài Liệu Chi Tiết

- 📂 [`client/README.md`](./client/README.md) — Cấu trúc & hướng dẫn frontend Next.js
- 📂 [`server/README.md`](./server/README.md) — Cấu trúc & hướng dẫn backend NestJS

## License

MIT