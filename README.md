# Creator app

## Overview

creator app is an API for Chaindox to create and verify the veriviable credentials. this app using Tradetrust Trust VC framework for MLETR SUPPORT
## Prerequisites

- Node.js (v20 or higher)
- npm
- Basic understanding of blockchain technology and smart contracts

## Setting Up the Project

Follow these steps to set up the project locally:

1. Clone the repository:

```bash
git clone https://github.com/TradeTrust/creator-tutorial.git
cd creator-tutorial
```

2. Install dependencies:

Use npm to install the necessary dependencies:

```bash
npm install
```

3. Copy the environment file and configure your settings:

```bash
cp .env.sample .env
```

Update the `.env` file with your settings for `DOMAIN`, `WALLET_PRIVATE_KEY`, and `NET`.

4. Excute the pre scripts:

```bash
npm run generate:did-web
npm run deploy:token-registry
```

5. Run the development server:

```bash
npm run dev
```