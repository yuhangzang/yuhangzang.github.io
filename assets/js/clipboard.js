export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return;
    } catch {
        // Older browsers and non-secure previews may lack the Clipboard API.
    }
    const previousFocus = document.activeElement;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.readOnly = true;
    textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.appendChild(textarea);
    try {
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
    } finally {
        textarea.remove();
        previousFocus?.focus({ preventScroll: true });
    }
}

export function initCopyButtons() {
    document.querySelectorAll('[data-copy-target]').forEach(button => {
        const target = document.getElementById(button.dataset.copyTarget);
        const status = document.getElementById(button.getAttribute('aria-describedby'));
        if (!target || !status) return;
        button.hidden = false;
        button.addEventListener('click', async () => {
            status.textContent = '';
            button.disabled = true;
            try {
                await copyText(target.textContent);
                status.textContent = 'BibTeX copied to clipboard.';
            } catch {
                status.textContent = 'Copy failed. Select the BibTeX below to copy it, or download the file.';
            } finally {
                button.disabled = false;
            }
        });
    });
}
