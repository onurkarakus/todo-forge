# Releasing

Nothing in this repo publishes automatically. These steps are for the maintainer.

## 1. Before a release

- [ ] `npm run check-types && npm run lint && npm test`
- [ ] `xvfb-run -a npm run test:integration` (or run it on a desktop)
- [ ] `npm run perf`; update [perf-notes.md](perf-notes.md) if numbers moved
- [ ] `npm run l10n`; every new string is in `l10n/bundle.l10n.tr.json`
- [ ] Bump `version` in `package.json`; add a dated section to `CHANGELOG.md`
- [ ] Re-take screenshots if the UI changed ([testing.md](testing.md#screenshots))
- [ ] Update the listing texts in [marketplace/](marketplace/)

### Versions

Use `major.EVEN_MINOR.patch` for stable releases and `major.ODD_MINOR.patch` for pre-releases (`vsce publish --pre-release`), as the VS Code docs recommend. VS Code updates users to the highest version, so a pre-release must never get a higher number than the next stable you plan to ship on the other track.

## 2. Build the VSIX files

```sh
npm run package:platforms           # all targets + universal into vsix/
node scripts/package.mjs win32-x64  # one target
```

Targets: `win32-x64`, `win32-arm64`, `linux-x64`, `linux-arm64`, `linux-armhf`, `alpine-x64`, `alpine-arm64`, `darwin-x64`, `darwin-arm64`, plus `universal` (all ripgrep binaries, for Open VSX users on other platforms). Each platform VSIX is about 2–3 MB because it carries one ripgrep binary in `bin/<platform>-<arch>/`.

Smoke-test one: `code --install-extension vsix/todoforge-linux-x64-1.0.0.vsix`.

## 3. README images

The Marketplace page does not serve images from the VSIX. `vsce` rewrites relative links in `README.md` to the GitHub repository in `package.json` (`main` branch).

**The repository is private today, so those links will not load on the Marketplace.** Pick one before publishing:

- make `onurkarakus/todo-forge` public (simplest), or
- host `media/` somewhere public over https and package with
  `vsce package --baseImagesUrl https://<host>/todo-forge/media/..`
  (adjust so `media/screenshots/demo.gif` resolves).

Images must be https and PNG, JPG or GIF. SVG images are rejected except badges from trusted providers. The icon must be a PNG (`media/icon.png`, 256×256).

## 4. Publish (maintainer only)

### Visual Studio Marketplace

Azure DevOps global personal access tokens are being retired: the VS Code publishing docs say December 1, 2026; the Azure DevOps blog says existing global PATs stop on January 27, 2027. Do not build a release process on a global PAT.

Recommended: **Trusted Publishing** from GitHub Actions or Azure Pipelines with federated identity (no stored secret). Follow "Secure automated publishing to Visual Studio Marketplace" in the VS Code docs: create a Trusted Publishing policy for the publisher `onurkarakus`, give the job `id-token: write`, and publish the per-platform VSIX files with `vsce publish --packagePath vsix/*.vsix` using the OIDC option the docs describe. For a private repo, run the workflow within 48 hours of creating the policy.

Manual alternative: upload each VSIX on the publisher management page (https://marketplace.visualstudio.com/manage).

Note: TodoForge itself has no CI features. A release workflow is maintainer tooling and is intentionally not in this repo yet.

### Open VSX

```sh
npx ovsx create-namespace onurkarakus -p <token>   # once
npx ovsx publish vsix/todoforge-linux-x64-1.0.0.vsix -p <token>
# repeat for each target, or publish the universal VSIX
```

The namespace must be claimed (verified) to remove the "unverified" warning.

### Verified publisher

The blue check on the Marketplace needs a verified domain and a publisher that has been active for at least six months. Plan for it after the first releases.

## 5. After a release

- Tag: `git tag v1.0.0 && git push --tags` (maintainer decision).
- Check the Marketplace page renders the GIF and screenshots.
- Watch the Q&A and issues for the first week.
