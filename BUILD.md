# Building and Distributing the Application

This document explains how to build installable versions of the Local Gateway Proxy for macOS, Windows, and Linux.

## Prerequisites

- Node.js and npm installed
- All dependencies installed (`npm install`)

## Generating Icons

Before building, you need to generate the application icons:

```bash
npm run build:icons
```

This will generate all required icon sizes from the SVG source file.

## Building for Specific Platforms

### macOS

Build a DMG and ZIP for macOS (Intel and Apple Silicon):

```bash
npm run build:mac
```

This will create:
- `release/Local Gateway Proxy-{version}-arm64.dmg` (Apple Silicon)
- `release/Local Gateway Proxy-{version}-x64.dmg` (Intel)
- `release/Local Gateway Proxy-{version}-arm64-mac.zip`
- `release/Local Gateway Proxy-{version}-x64-mac.zip`

### Windows

Build NSIS installer and portable version for Windows:

```bash
npm run build:win
```

This will create:
- `release/Local Gateway Proxy Setup {version}.exe` (Installer)
- `release/Local Gateway Proxy {version}.exe` (Portable)

### Linux

Build AppImage, DEB, and RPM packages for Linux:

```bash
npm run build:linux
```

This will create:
- `release/Local Gateway Proxy-{version}.AppImage`
- `release/Local Gateway Proxy_{version}_amd64.deb`
- `release/Local Gateway Proxy_{version}.x86_64.rpm`

### All Platforms

Build for all platforms at once:

```bash
npm run build:all
```

## Build Process

The build process:
1. Generates icons from SVG source
2. Compiles TypeScript code
3. Builds the React/Vite frontend
4. Packages everything into platform-specific installers

## Output Location

All built files are placed in the `release/` directory.

## Notes

- **macOS**: Requires code signing for distribution outside the App Store. For development/testing, you can build without signing.
- **Windows**: The NSIS installer allows users to choose installation directory.
- **Linux**: AppImage is a portable format that doesn't require installation.

## Troubleshooting

### Icon Generation Fails
- Ensure `sharp` is installed: `npm install --save-dev sharp`
- Check that `build/icons/icon.svg` exists

### Build Fails on macOS
- Ensure you have Xcode Command Line Tools installed
- For Apple Silicon builds, you may need Rosetta 2

### Build Fails on Windows
- Ensure you have the necessary build tools installed
- Check Windows Defender isn't blocking the build process

### Build Fails on Linux
- Install required dependencies:
  - For AppImage: `libfuse2`
  - For DEB: `dpkg` and related tools
  - For RPM: `rpmbuild`

