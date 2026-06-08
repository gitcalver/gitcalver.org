;;; Directory Local Variables.  -*- no-byte-compile: t -*-

;; Hugo layouts contain Go template syntax ({{ define }}, {{- /* ... */ -}}).
;; Prettier (run on save by apheleia) reflows it as if it were plain HTML and
;; splits the single-line license comment, which de-registers `define "main"'
;; and renders the page blank.  These templates are hand-formatted on purpose,
;; so keep apheleia off them.  `apheleia-inhibit' is a safe-local-variable, so
;; this applies without a prompt.

((nil . ((apheleia-inhibit . t))))
