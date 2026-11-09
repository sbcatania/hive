// Prints the wordmark's SVG; used by og-wordmark.mjs.
import * as React from "react";
(globalThis as { React?: typeof React }).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { Wordmark } from "../src/components/Wordmark";
process.stdout.write(renderToStaticMarkup(<Wordmark />));
