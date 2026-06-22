# Learn-Hub Client

> Frontend cho nền tảng Learn-Hub — giao diện tương tác **Học Viện AI Nhí**, xây dựng bằng **Next.js 16** (App Router) với **React 19**.

## Tech Stack

| Công nghệ | Version | Vai trò |
|------------|---------|---------|
| **Next.js** | 16.2.9 | Framework React full-stack |
| **React** | 19.2.4 | UI library |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Lucide React** | 1.x | Icon library |
| **TypeScript** | 5.x | Type safety |
| **Turbopack** | Built-in | Dev server bundler (mặc định) |

## Cấu Trúc Dự Án

```
client/
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # Root layout (fonts, metadata, global styles)
│   │   ├── globals.css            # Global CSS + Tailwind theme tokens
│   │   ├── favicon.ico
│   │   │
│   │   └── (public)/              # Route group — public pages (không thêm prefix vào URL)
│   │       ├── page.tsx           # Trang chủ: 4 cards điều hướng chính
│   │       └── concepts/
│   │           └── page.tsx       # Trang "Lớp Học AI"
│   │
│   ├── components/                # UI components tái sử dụng
│   │   └── (trống — đang phát triển)
│   │
│   └── lib/                       # Utilities & helpers
│       └── audio.ts               # playClickSound() — hiệu ứng âm thanh click
│
├── public/                        # Static assets (images, fonts, ...)
├── next.config.ts                 # Next.js configuration
├── postcss.config.mjs             # PostCSS + @tailwindcss/postcss
├── tsconfig.json                  # TypeScript configuration
├── eslint.config.mjs              # ESLint flat config
├── Dockerfile                     # Docker image cho client
└── package.json
```

## Các Trang Hiện Có

| Route | File | Mô tả |
|-------|------|-------|
| `/` | `(public)/page.tsx` | Trang chủ — 4 cards: Lớp Học AI, Đếm Ngón Tay, Ảo Thuật Tay, Thám Tử Mặt |
| `/concepts` | `(public)/concepts/page.tsx` | Trang giới thiệu các khái niệm AI |

## Cài Đặt & Chạy

```bash
npm install
npm run dev
```

Truy cập `http://localhost:3000`.

## Scripts

| Script | Lệnh | Mô tả |
|--------|-------|-------|
| `npm run dev` | `next dev` | Chạy dev server (Turbopack) |
| `npm run dev:clean` | Xóa `.next` → `next dev` | Xóa cache rồi chạy dev — dùng khi gặp lỗi cache |
| `npm run clean` | `npx rimraf .next` | Chỉ xóa thư mục cache `.next` |
| `npm run build` | `next build` | Build production |
| `npm run start` | `next start` | Chạy production server |
| `npm run lint` | `eslint` | Kiểm tra code style |

## Cấu Hình Chính

### Fonts

Sử dụng `next/font/google` để tối ưu tải font:
- **Geist Sans** — Font chính (`--font-geist-sans`)
- **Geist Mono** — Font monospace (`--font-geist-mono`)

### Tailwind CSS 4

Cấu hình qua `postcss.config.mjs` với plugin `@tailwindcss/postcss`. Theme tokens được khai báo trong `globals.css`:

```css
@import "tailwindcss";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

### Path Aliases

```json
{
  "@/*": ["./src/*"]
}
```

Import ví dụ: `import { playClickSound } from '@/lib/audio'`

## Tài Liệu Tham Khảo

- [Next.js 16 Documentation](https://nextjs.org/docs)
- [React 19](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev)
