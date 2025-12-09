# Release Checklist

## Pre-Release Verification

### ✅ Application Identity
- [x] Application name: **Local Gateway Proxy**
- [x] Product name consistent across all files
- [x] App ID: `com.proxyapp.localgateway`
- [x] Version: `1.0.0`
- [x] Description updated
- [x] Keywords added for discoverability

### ✅ Icons & Assets
- [x] Icons generated for all platforms
- [x] Icon SVG source maintained
- [x] Icons properly referenced in build config
- [x] Window icon set in main process

### ✅ Build Configuration
- [x] Electron Builder configured
- [x] macOS targets: DMG + ZIP (x64 + arm64)
- [x] Windows targets: NSIS installer + Portable
- [x] Linux targets: AppImage + DEB + RPM
- [x] Output directory: `release/`

### ✅ Code Quality
- [x] TypeScript compilation working
- [x] No linter errors
- [x] All features tested
- [x] Window title set correctly
- [x] App name set in Electron app

### ✅ Documentation
- [x] README.md updated
- [x] BUILD.md created with build instructions
- [x] .gitignore configured
- [x] All file references use correct app name

### ✅ Files Updated
- [x] `package.json` - name, description, keywords, build config
- [x] `src/main/index.ts` - window title and app name
- [x] `src/renderer/index.html` - page title
- [x] `src/renderer/src/components/Layout/Sidebar.tsx` - app name display
- [x] `README.md` - title and references
- [x] `BUILD.md` - build instructions

## Pre-Release Steps

1. **Update Version** (if needed):
   ```bash
   npm version patch|minor|major
   ```

2. **Generate Icons**:
   ```bash
   npm run build:icons
   ```

3. **Test Build Locally**:
   ```bash
   npm run build
   npm start
   ```

4. **Build for Your Platform**:
   ```bash
   # macOS
   npm run build:mac
   
   # Windows
   npm run build:win
   
   # Linux
   npm run build:linux
   ```

5. **Test Installer**:
   - Install the generated package
   - Verify app launches correctly
   - Test core functionality
   - Check icon displays correctly
   - Verify app name in system

## Release Notes Template

```markdown
## Version 1.0.0

### Features
- Multiple workspace management
- AWS API Gateway configuration support
- Endpoint enable/disable controls
- Variable mapping
- Real-time server logs
- Bypass configuration for disabled endpoints
- Drag-and-drop workspace reordering
- Workspace duplication
- Modern, intuitive UI

### Platforms
- macOS (Intel & Apple Silicon)
- Windows (x64)
- Linux (AppImage, DEB, RPM)
```

## Post-Release

- [ ] Tag release in git
- [ ] Create GitHub release (if applicable)
- [ ] Update changelog
- [ ] Announce release

