let currentTool;

function notify(message) {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: message }));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function shareUrl(tool) {
  const url = new URL(location.href);
  url.hash = `tool=${encodeURIComponent(tool.id)}`;
  return url.toString();
}

export function openShareDialog(tool) {
  currentTool = tool;
  const dialog = document.querySelector("#share-dialog");
  if (!dialog) return;
  dialog.querySelector("[data-share-name]").textContent = tool.name;
  document.body.classList.add("is-locked");
  dialog.showModal();
}

export function initShare() {
  const dialog = document.querySelector("#share-dialog");
  if (!dialog) return;
  dialog.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-share-action]")?.dataset.shareAction;
    if (!action || !currentTool) return;
    const url = shareUrl(currentTool);
    const text = `${currentTool.name}：${currentTool.tagline_zh}`;
    if (action === "close") {
      dialog.close();
      return;
    }
    if (action === "copy-link") {
      await copyText(url);
      notify("链接已复制");
    } else if (action === "copy-intro") {
      await copyText(`${text}\n${currentTool.official_url || url}`);
      notify("工具简介已复制");
    } else if (action === "x") {
      window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
    } else if (action === "telegram") {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } else if (action === "native") {
      if (navigator.share) {
        try {
          await navigator.share({ title: currentTool.name, text, url });
        } catch (error) {
          if (error.name !== "AbortError") console.warn("[share] 系统分享失败", error);
        }
      } else {
        await copyText(url);
        notify("当前浏览器不支持系统分享，链接已复制");
      }
    }
  });
}
