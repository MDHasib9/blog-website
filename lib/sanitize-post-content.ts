import sanitizeHtml from "sanitize-html";

const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "blockquote",
    "br",
    "code",
    "del",
    "em",
    "h1",
    "h2",
    "h3",
    "hr",
    "img",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "strong",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "name", "target"],
    img: ["src", "alt", "title", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attributes) => ({
      tagName,
      attribs: {
        ...attributes,
        rel: "nofollow noopener noreferrer",
      },
    }),
  },
};

export function sanitizePostContent(content: string): string {
  return sanitizeHtml(content, options);
}
