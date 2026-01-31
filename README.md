# 👻 Vanta Protocol

<div align="center">

![Vanta Protocol](https://img.shields.io/badge/Solana-Privacy-purple?style=for-the-badge&logo=solana)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Mainnet%20Beta-blue?style=for-the-badge)

**Privacy-Preserving Payments on Solana**

_Send and receive tokens privately with Zero-Knowledge Proofs and Compliance built-in._

[Demo Video](#demo) • [Features](#features) • [How It Works](#how-it-works) • [Getting Started](#getting-started)

</div>

---

## 📖 Overview

**Vanta Protocol** is a privacy-focused payment application built on Solana that enables users to:

- 🔒 **Deposit tokens into a private balance** using Zero-Knowledge proofs
- 💸 **Transfer privately** to any Solana wallet without revealing transaction details
- 🔗 **Create Vanta Links** - shareable payment links that anyone can claim
- ✅ **Stay compliant** with built-in risk assessment via Range Protocol

The protocol leverages **Radr ShadowWire SDK** for privacy-preserving transactions and **Range Protocol** for compliance checks, ensuring that private transactions are both secure and compliant.

---

## ✨ Features

### 🏦 Private Wallet

- Deposit SOL and SPL tokens into your private balance
- Withdraw back to your public wallet anytime
- Real-time balance tracking with ZK proofs

### 💳 Private Transfers

- Send tokens to any wallet address privately
- Zero-Knowledge proofs hide sender, recipient, and amount
- Built-in compliance check before every transfer

### 🔗 Vanta Links

- Create shareable payment links
- Recipients claim without knowing the sender
- QR code generation for easy sharing
- Gasless claims - fees paid by the link creator

### 🛡️ Compliance Integration

- **Range Protocol** integration for risk scoring
- Automatic wallet screening (0-10 risk score)
- Blocks high-risk wallets (score ≥ 7)
- Protects against sanctioned addresses

### 🪙 Multi-Token Support

- SOL (Native)
- USDC
- USD1 (World Liberty Financial)
- BONK
- ZEC (Portal/Wormhole)
- And 15+ more tokens

---

## 🛠️ Technology Stack

| Component      | Technology            | Purpose                       |
| -------------- | --------------------- | ----------------------------- |
| **Frontend**   | Next.js 16 + React 19 | Modern web application        |
| **Styling**    | Tailwind CSS 4        | UI components                 |
| **Blockchain** | Solana Web3.js        | Blockchain interactions       |
| **Privacy**    | Radr ShadowWire SDK   | ZK proofs & private transfers |
| **Compliance** | Range Protocol API    | Wallet risk assessment        |
| **RPC**        | Helius                | Fast & reliable Solana RPC    |
| **Wallets**    | Phantom, Solflare     | Wallet connection             |

---

## 🔧 How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vanta Protocol                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Wallet     │    │   Private    │    │   Vanta      │      │
│  │   Manager    │    │   Transfer   │    │   Links      │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  ShadowWire SDK │                          │
│                    │   (ZK Proofs)   │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│         ┌───────────────────┼───────────────────┐               │
│         │                   │                   │               │
│  ┌──────▼───────┐    ┌──────▼───────┐    ┌──────▼───────┐      │
│  │   Range      │    │   Solana     │    │   Helius     │      │
│  │  Compliance  │    │  Blockchain  │    │    RPC       │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Flow: Private Transfer

1. **Compliance Check** → Range API validates sender wallet
2. **ZK Proof Generation** → ShadowWire creates privacy proof
3. **Transaction Signing** → User signs in wallet
4. **Relayer Submission** → Helius RPC broadcasts transaction
5. **Confirmation** → Transfer complete, balances updated

### Flow: Vanta Link

1. **Create Link** → User specifies amount and token
2. **Temporary Wallet** → System generates ephemeral keypair
3. **Fund Transfer** → Tokens moved to temporary wallet
4. **Share Link** → URL contains encrypted secret key
5. **Claim** → Recipient connects wallet and claims funds

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn** or **pnpm**
- **Phantom** or **Solflare** wallet browser extension
- **Helius API Key** (optional, for better RPC performance)
- **Range API Key** (for compliance features)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/vanta-protocol.git
cd vanta-protocol
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Configure environment variables**

Create a `.env.local` file in the root directory:

```env
# Helius RPC (recommended for better performance)
NEXT_PUBLIC_HELIUS_RPC=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY

# Range Protocol API Key (required for compliance)
RANGE_API_KEY=YOUR_RANGE_API_KEY
```

> **Note:** Without Helius, the app will use public Solana RPC (may be slower/rate-limited).

4. **Run the development server**

```bash
npm run dev
```

5. **Open in browser**

Navigate to [http://localhost:3000](http://localhost:3000)

---

## 📱 Usage Guide

### 1. Connect Your Wallet

Click the **"Select Wallet"** button in the header to connect Phantom or Solflare.

### 2. Deposit Tokens (Wallet Tab)

1. Select the token you want to deposit
2. Enter the amount
3. Click **"Deposit"**
4. Approve the transaction in your wallet
5. Wait for ZK proof generation and confirmation

### 3. Private Transfer (Transfer Tab)

1. Enter the recipient's Solana address
2. Enter the amount to send
3. Click **"Send Private Transfer"**
4. System will:
   - Check compliance (Range)
   - Generate ZK proof
   - Submit via relayer
5. Transaction completes privately

### 4. Create Vanta Link (Vanta Link Tab)

1. Enter the amount for the link
2. Click **"Create Vanta Link"**
3. System generates a unique URL
4. Copy the link or scan the QR code
5. Share with recipient
6. Recipient opens link, connects wallet, and claims

### 5. Claim a Vanta Link

1. Open the Vanta Link URL
2. Connect your wallet
3. Click **"Claim Gift"**
4. Funds are transferred to your wallet (gasless!)

---

## 🔐 Security Considerations

- **Private keys never leave your wallet** - All signing happens locally
- **Vanta Link secrets are in URL hash** - Never sent to servers
- **Range compliance** - Prevents interaction with sanctioned addresses
- **ZK proofs** - Transaction details are cryptographically hidden

---

## 📁 Project Structure

```
vanta/
├── app/
│   ├── page.tsx              # Main application page
│   ├── ShadowTerminal.tsx    # Core terminal UI component
│   ├── layout.tsx            # Root layout with providers
│   ├── globals.css           # Global styles
│   ├── claim/
│   │   └── page.tsx          # Vanta Link claim page
│   └── api/
│       └── compliance/
│           └── route.ts      # Range Protocol API integration
├── components/
│   ├── WalletManager.tsx     # Deposit/Withdraw functionality
│   ├── PrivatePayroll.tsx    # Private transfer functionality
│   ├── ShadowLinkCreator.tsx # Vanta Link creation
│   ├── LinkStorage.tsx       # Link history management
│   ├── SystemStatus.tsx      # Connection status display
│   ├── ProcessStatus.tsx     # Transaction progress UI
│   ├── PrivacyEducation.tsx  # Educational tooltips
│   └── ui/                   # Reusable UI components
├── lib/
│   ├── SolanaProvider.tsx    # Wallet adapter configuration
│   ├── tokens.ts             # Supported token definitions
│   ├── fees.ts               # Fee calculation utilities
│   └── utils.ts              # Helper functions
└── public/
    ├── icons/                # Token icons
    ├── images/               # App images
    └── wasm/                 # ShadowWire WASM binaries
```

---

## 🌐 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `NEXT_PUBLIC_HELIUS_RPC`
   - `RANGE_API_KEY`
4. Deploy!

### Manual Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## 🔑 Environment Variables

| Variable                 | Required | Description                           |
| ------------------------ | -------- | ------------------------------------- |
| `NEXT_PUBLIC_HELIUS_RPC` | Optional | Helius RPC URL for better performance |
| `RANGE_API_KEY`          | Yes      | Range Protocol API key for compliance |

---

## 🛣️ Network Configuration

The application is configured for **Solana Mainnet Beta** by default.

To switch to Devnet for testing, modify `lib/SolanaProvider.tsx`:

```typescript
const network = WalletAdapterNetwork.Devnet; // Change to Devnet
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- **[Radr Labs](https://radr.dev)** - ShadowWire SDK for privacy-preserving transactions
- **[Helius](https://helius.dev)** - Fast and reliable Solana RPC infrastructure
- **[Range Protocol](https://range.org)** - Compliance and risk assessment API
- **[Encrypt.trade](https://encrypt.trade)** - Privacy education resources

---

## 📞 Support

If you have any questions or need help, please:

- Open an issue on GitHub
- Check existing issues for solutions

---

<div align="center">

**Built with 💜 for the Solana Ecosystem**

_Privacy is not a privilege, it's a right._

</div>
