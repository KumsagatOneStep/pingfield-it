"use client";
import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isSafeHref, isSafeImageSrc } from "@/lib/helper/files";

// Raw HTML is never rendered (no rehype-raw). Only internal attachment images and
// http(s)/mailto/relative links survive urlTransform.
const urlTransform = (url: string, key: string) =>
  key === "src" ? (isSafeImageSrc(url) ? url : "") : isSafeHref(url) ? url : "";

const textOf = (n: ReactNode): string =>
  typeof n === "string" || typeof n === "number"
    ? String(n)
    : Array.isArray(n)
      ? n.map(textOf).join("")
      : n && typeof n === "object" && "props" in n
        ? textOf((n as { props: { children?: ReactNode } }).props.children)
        : "";

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textOf(children).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="md-code">
      <button type="button" className="md-copy" onClick={copy}>{copied ? "Скопировано" : "Скопировать"}</button>
      <pre>{children}</pre>
    </div>
  );
}

function Img({ src, alt }: { src?: string | Blob; alt?: string }) {
  const [broken, setBroken] = useState(false);
  if (typeof src !== "string" || !src) return <span className="md-noimg">внешняя картинка не показывается</span>;
  if (broken) return <span className="md-noimg">картинка удалена</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt ?? ""} loading="lazy" onError={() => setBroken(true)} />;
}

const components: Components = {
  pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
  img: ({ src, alt }) => <Img src={src} alt={alt} />,
  a: ({ href, children }) =>
    href ? (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ) : (
      <span>{children}</span>
    ),
};

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
