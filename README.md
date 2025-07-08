# epanet-js


[epanet-js](https://epanetjs.com) is a web application that makes [EPANET](https://www.epa.gov/water-research/epanet) accessible from the browser.

![epanet-js app](https://github.com/user-attachments/assets/dc6bbd39-bf00-4fab-8c22-b0fb4e05c2be)


The project is a NextJS application. Although most of the logic occurs on the browser, it uses cloud functions to protect secrets and authenticate users.

## Getting started

#### Install dependencies

```sh
pnpm install
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
