# Google Form → students.json sync

This Apps Script is intended to be bound to the spreadsheet receiving the Google Form responses.

## Setup

1. Open the `self introduction` response spreadsheet and choose **Extensions → Apps Script**.
2. Replace the editor contents with `Code.gs` from this folder.
3. Create a fine-grained GitHub personal access token for the `tpemartin/econ115B` repository with **Contents: Read and write** permission.
4. In Apps Script, open **Project Settings → Script Properties** and add:
   - Property: `GITHUB_TOKEN`
   - Value: your GitHub token
5. Run `installTriggers` once and approve the requested permissions.
6. Run `syncAllResponses` once to publish all responses that existed before the triggers were installed.
7. Optionally select one response row and run `syncSelectedRow` for an individual end-to-end test.

The script installs two spreadsheet triggers:

- Form submit: handles new submissions and response resubmissions.
- Edit: handles manual changes to the identity or introduction cells in the response sheet.

Only `學號後3碼＋姓名` and `自我介紹` are read. Email addresses and phone numbers are never published. Each update changes only `public/data/students.json` in one GitHub commit.

`syncAllResponses` reads the complete response sheet and creates one GitHub commit for the batch. If a student has submitted more than once, the last row is treated as the latest response. Identities that do not match the roster are listed in the Apps Script execution log and are not added to the public JSON.

The configured response source is spreadsheet `1B8DXuYoBqRSns9YKyZcbPRr8AfPXa2x8C7pFZEkNgMA`, worksheet `self introduction`.
