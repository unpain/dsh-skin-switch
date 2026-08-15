# Bilingual README design

## Goal

Keep English as the repository landing page while providing a complete Simplified Chinese README with direct language switching. Both documents must describe the same supported installation and skin-management behavior.

## File layout

- `README.md` remains the default English document.
- `README.zh-CN.md` contains the full Simplified Chinese version.
- `README.md` starts with `English | [简体中文](README.zh-CN.md)`.
- `README.zh-CN.md` starts with `[English](README.md) | 简体中文`.

A separate language landing page is not needed. It would add a click without improving navigation.

## Content contract

The two README files use the same section order and cover the same facts:

1. project purpose;
2. DSH and private GitHub access requirements;
3. GitHub authentication and one-command installation;
4. optional `@linxin666/dsh-skins` collection installation;
5. full-skin registration API and field reference;
6. development commands and committed artifact policy;
7. compatibility, assets, and license.

Commands, package names, API names, TypeScript identifiers, paths, and version numbers remain unchanged between languages. The Chinese text should read as native technical documentation rather than a sentence-by-sentence machine translation.

## Package contract

Add `README.zh-CN.md` to `package.json#files`. Direct Git and packed-package consumers should receive both documents.

## Verification

Extend the existing package contract tests to verify:

- both README files exist;
- each README links to the other language;
- both contain the documented manager and collection installation commands;
- `package.json#files` includes both README files.

Run the focused package test, then the complete test suite. Commit the documentation, package metadata, test, and design artifacts together and push `main` after verification.

## Non-goals

- Translating source comments or API identifiers.
- Adding automatic browser-language detection.
- Maintaining a third landing-page README.
- Changing plugin runtime behavior or installation commands.
