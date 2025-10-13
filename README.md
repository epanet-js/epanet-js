# epanet-js

> ⚠️ **License notice:** This project is under the Functional Source License (FSL-1.1-MIT). You can use and contribute freely for personal, research, and internal purposes. Commercial or competing uses are **not allowed** until a commit transitions to MIT after two years. If you work for a commercial entity, consult your legal team before downloading, viewing or adapting this code - [learn more](#before-you-use-or-view-this-code).

[epanet-js](https://epanetjs.com) is a web application that makes [EPANET](https://www.epa.gov/water-research/epanet) accessible from the browser.

![epanet-js app](https://github.com/user-attachments/assets/dc6bbd39-bf00-4fab-8c22-b0fb4e05c2be)

The project is a NextJS application built ontop of [Placemark](https://github.com/placemark/placemark). Although most of the logic occurs on the browser, it uses cloud functions to protect secrets and authenticate users.

## Before you use or view this code

This project is licensed under the **[Functional Source License (FSL-1.1-MIT)](/LICENSE)**. That means:

✅ **What you _can_ do right now**

- Use the code for personal projects, research, or education
- Explore, learn from, and contribute improvements back
- Deploy it internally for your own organization’s use, including making modifications for your own needs
- Share forks and modifications as long as they respect the license

🚫 **What you _can’t_ do right now**

- Package this code into your own commercial app or service
- Build a competing product (commercial or open source) that offers the same functionality
- Sell or offer hosted versions of this project

⚠️ **If you work for a commercial entity**

- You’re welcome to read the code to understand how it works, or to learn from it.
- But adapting it directly for your own commercial product or service is **not allowed under the FSL**.
- Even downloading or viewing the code could put your company at legal risk — please check with your internal legal team before doing so.

⏳ **Future open source**
Each commit will become fully open source under the MIT license after **two years**. The FSL gives us space to keep innovating while ensuring that in time, everything we build is returned to the community as free and open source software.

This model helps prevent harmful free riding and keeps development sustainable. If you’re curious, you can read more about why we chose this approach on our [website](https://epanetjs.com/#why-we-built-epanet-js).

## Getting started

#### Install dependencies

```sh
pnpm install
```

##### Issues with Apple Silicon
We use the `node-canvas` library and the version we use does not include a packaged build for Apple Silicon. There is a build script available but `pnpm` does not launch it automatically. If you run into problems try the following:
1. Manually install the dependencies to run the build script [official documentation](https://github.com/Automattic/node-canvas/wiki/Installation%3A-Mac-OS-X)
2. Manually execute the `canvas` package build script
```sh
cd node_modules/canvas
npm run install
```

#### Configuration

Copy the contents from `.env.example` to `.env` and edit with the values from your accounts.

#### Dev server

You can start the dev server with the following command.

```sh
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

_Notice: if you see a ChunkLoadError, try refreshing the page._

#### Run tests

```sh
pnpm test
```

Or in watch mode:

```sh
pnpm test:watch
```

#### Check types

```sh
pnpm check-types
```

Or in watch mode:

```sh
pnpm check-types:watch
```

#### Run linter

```sh
pnpm lint
```

#### Pre-commit hook

To prevent pushing code that has linter or types errors you can add to `.git/hooks/pre-commit` the following:

```
#!/bin/sh
echo "Running type check..."
pnpm run check-types || exit 1

echo "Running lint..."
pnpm run lint || exit 1

echo "✅ All checks passed!"
```

## Deploy

You will need to configure the environment variables for the deployment. You can find the list of variables in `.env.example`.

To deploy you will need to run the `next build`.

In Vercel you can use this command:

```sh
pnpm lint && NODE_ENV=test pnpm test && NODE_ENV=production next build
```

## License

This repository contains code under two different licenses:

1. **Placemark clone (MIT License)**: All code from the first commit (`0fa095f5c60ba944fa4e25b8a7e749e52c2beefb`) is licensed under the MIT License.
2. **Modifications and Future Contributions (FSL-1.1-MIT)**: Any changes or contributions made after the first commit (`0fa095f5c60ba944fa4e25b8a7e749e52c2beefb`) onwards are licensed under the FSL-1.1-MIT License.

You can find the full text of the MIT License in the `LICENSE` file.

