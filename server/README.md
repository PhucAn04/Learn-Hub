# Learn-Hub Server

> Backend API cho nền tảng Learn-Hub, xây dựng bằng **NestJS 11** với **TypeORM** và **PostgreSQL**.

## Tech Stack

| Công nghệ | Version | Vai trò |
|------------|---------|---------|
| **NestJS** | 11.x | Framework chính |
| **TypeORM** | 1.x | ORM & database migrations |
| **PostgreSQL** | 15 | Cơ sở dữ liệu |
| **Passport** | 0.7 | Authentication |
| **Swagger** | 11.x | API documentation |
| **Jest** | 30.x | Unit & E2E testing |

## Cấu Trúc Dự Án

```
server/
├── src/
│   ├── main.ts                    # Entry point — Bootstrap NestJS + Swagger
│   ├── app.module.ts              # Root module (imports Config, Database)
│   ├── app.controller.ts          # Root controller
│   ├── app.service.ts             # Root service
│   │
│   └── shared/                    # Shared modules dùng chung
│       ├── config/
│       │   └── config.module.ts   # @nestjs/config — load biến môi trường
│       ├── database/
│       │   ├── database.module.ts # TypeORM connection setup
│       │   ├── typeorm.config.ts  # TypeORM CLI config (migrations)
│       │   └── migrations/        # Database migration files
│       └── common/
│           └── guards/            # Auth guards (Passport)
│
├── test/                          # E2E tests
├── .env                           # Biến môi trường (không commit)
├── .env.example                   # Template biến môi trường
├── Dockerfile                     # Docker image cho server
├── nest-cli.json                  # NestJS CLI config
├── tsconfig.json                  # TypeScript config
└── package.json
```

## Cài Đặt & Chạy

### Biến Môi Trường

Tạo file `.env` từ template:

```bash
cp .env.example .env
```

Nội dung `.env.example`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database (kết nối đến PostgreSQL qua Docker exposed port)
DATABASE_HOST=localhost
DATABASE_PORT=5433
DATABASE_USERNAME=learn_hub_user
DATABASE_PASSWORD=secret
DATABASE_NAME=learn_hub_db
```

> **Lưu ý:** Khi chạy trong Docker Compose, biến môi trường được set trong `docker-compose.yml` với `DB_HOST=db` (service name) và `DB_PORT=5432` (internal port).

### Chạy Development

```bash
npm install
npm run start:dev
```

Server sẽ chạy tại `http://localhost:3001` với hot-reload (watch mode).

### Swagger API Docs

Sau khi server chạy, truy cập:

```
http://localhost:3001/api/docs
```

## Scripts

| Script | Lệnh | Mô tả |
|--------|-------|-------|
| `npm run start` | `nest start` | Chạy server |
| `npm run start:dev` | `nest start --watch` | Chạy với hot-reload |
| `npm run start:debug` | `nest start --debug --watch` | Chạy với debugger |
| `npm run start:prod` | `node dist/main` | Chạy production build |
| `npm run build` | `nest build` | Build TypeScript |
| `npm run lint` | `eslint --fix` | Lint & auto-fix code |
| `npm run format` | `prettier --write` | Format code |

### Database Migrations

```bash
# Tạo migration mới từ entity changes
npm run migration:generate -- src/shared/database/migrations/MigrationName

# Chạy migrations
npm run migration:run

# Revert migration gần nhất
npm run migration:revert
```

### Testing

```bash
npm run test          # Unit tests
npm run test:watch    # Watch mode
npm run test:cov      # Coverage report
npm run test:e2e      # End-to-end tests
```

## Kiến Trúc Module

```
AppModule
├── ConfigModule       — Load .env, quản lý biến môi trường
└── DatabaseModule     — Kết nối TypeORM ↔ PostgreSQL, migrations
```

## Tài Liệu Tham Khảo

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [Swagger / OpenAPI](https://docs.nestjs.com/openapi/introduction)
