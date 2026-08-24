import test from "node:test";
import assert from "node:assert/strict";

import { jsonLdScriptProps } from "./jsonLd.ts";

test("jsonLdScriptProps: type es application/ld+json", () => {
  const props = jsonLdScriptProps({ a: 1 });
  assert.equal(props.type, "application/ld+json");
});

test("jsonLdScriptProps: serializa el dato como JSON dentro de __html", () => {
  const props = jsonLdScriptProps({ nombre: "Sonoro", precio: 1 });
  assert.equal(props.dangerouslySetInnerHTML.__html, '{"nombre":"Sonoro","precio":1}');
});

test("jsonLdScriptProps: escapa '<' para que un valor con </script> no rompa la página", () => {
  const props = jsonLdScriptProps({ nombre: "Bocina </script><script>alert(1)</script>" });
  const html = props.dangerouslySetInnerHTML.__html;
  assert.ok(!html.includes("</script>"));
  assert.ok(html.includes("\\u003c/script>"));
});
