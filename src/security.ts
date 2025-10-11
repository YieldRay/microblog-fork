import DOMPurify from 'isomorphic-dompurify';


const SAFE_HTML_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins',
    'blockquote', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'a', 'span', 'div'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'class', 'id'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_TRUSTED_TYPE: false
};


export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const cleanHtml = DOMPurify.sanitize(html, SAFE_HTML_CONFIG);
  
  return cleanHtml;
}


export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeUserContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  let sanitized = content.trim();
  
  // Convert URLs to links
  sanitized = sanitized.replace(
    /(https?:\/\/[^\s<>"']+)/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  
  // Preserve links while escaping other HTML
  const linkPlaceholders: string[] = [];
  sanitized = sanitized.replace(/<a[^>]*>.*?<\/a>/gi, (match) => {
    const placeholder = `__LINK_${linkPlaceholders.length}__`;
    linkPlaceholders.push(match);
    return placeholder;
  });
  
  // Escape HTML entities
  sanitized = escapeHtml(sanitized);

  // Restore links
  linkPlaceholders.forEach((link, index) => {
    sanitized = sanitized.replace(`__LINK_${index}__`, link);
  });
  
  // Convert line breaks to HTML
  sanitized = sanitized.replace(/\n/g, '<br>');
  
  return sanitized;
}

export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol.toLowerCase();
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol);
  } catch {
    return false;
  }
}


export function sanitizeActivityPubContent(content: string): string {
  if (!content || typeof content !== 'string') {
    return '';
  }

  const strictConfig = {
    ...SAFE_HTML_CONFIG,
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'span'],
    ALLOWED_ATTR: ['href', 'rel'],
  };

  const cleanHtml = DOMPurify.sanitize(content, strictConfig);
  
  return cleanHtml.replace(
    /<a\s+href="([^"]*)"[^>]*>/gi,
    (match, href) => {
      if (isSafeUrl(href)) {
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">`;
      }
      return '<span>';
    }
  );
}
