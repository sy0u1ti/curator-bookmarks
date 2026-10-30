# Action feedback

Curator's implementation of the interaction patterns reviewed from Evil Buttons:

- https://www.evilbuttons.com/docs/morph-status-button
- https://www.evilbuttons.com/docs/reveal-button
- https://www.evilbuttons.com/docs/copy-button
- https://www.evilbuttons.com/docs/hold-button

These components use the existing Base UI controls, icon set, motion tokens and
semantic colors. No upstream component source or additional motion dependency is
vendored.

`StatusButton` receives explicit controller results. Calling a void dispatcher
does not imply success. Terminal feedback expires after 2.4 seconds; detailed
errors remain in the owning surface. Popup and New Tab reject results from an
obsolete session.

`RevealInput` stays editable and hides its value when focus leaves the field,
the window loses focus, the document becomes hidden, or Escape is pressed.

`HoldConfirmButton` arms after 900 ms and confirms on release. Leaving, canceling,
blurring, disabling or unmounting cancels the gesture. Keyboard holds use Space
or Enter without reacting to repeats. Assistive activation has an untimed
two-activation alternative. A confirmation request ID remounts the button so a
new dialog cannot inherit another request's gesture.

Run `npm run test:action-feedback` for state and production-handler regressions.
After `npm run build`, run `npm run test:action-feedback-browser` for Ego checks.
Use `-- --space <id> --from <surface>` to resume an existing QA task; surfaces
are `controls`, `options`, `popup`, `sidepanel`, and `newtab`. The fixture uses
real view components and production CSS with isolated I/O; it never edits
the user's extension data.
