# BITS Pilani Leave Form

A browser-based tool for generating the Parent Consent Form required for student leave at BITS Pilani, Pilani Campus. Fill in the details and export as PDF or DOCX.

## Features

- **PDF & DOCX export** — generates a filled-in consent form using the official template
- **Duration auto-fill** — enter a duration in days and the to-date is calculated automatically
- **Signature cropping** — upload a signature image and crop it in-browser before export
- **Persistent details** — student and parent info is saved in localStorage for returning visits
- **Mobile friendly** — responsive layout that works on any screen size

## Setup

```sh
bun install
bun run dev
```

## Build

```sh
bun run build
```

## Stack

React 19, TypeScript, Vite, [pdf-lib](https://github.com/Hopding/pdf-lib), [docx](https://github.com/dolanmiri/docx)
