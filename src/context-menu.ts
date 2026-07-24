// ============================================================================
// 再利用可能なポップアップメニュー（右クリック / ⋯ ボタン用）
// ============================================================================
export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}

let menuEl: HTMLDivElement | null = null;

// 開いているメニューを閉じる。
export function closeContextMenu(): void {
  menuEl?.remove();
  menuEl = null;
}

// 画面座標 (x, y) にメニューを開く。同時に開くのは1つだけ。
export function openContextMenu(items: MenuItem[], x: number, y: number): void {
  closeContextMenu();
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  for (const it of items) {
    const b = document.createElement("button");
    b.className = "ctx-item" + (it.danger ? " danger" : "");
    b.textContent = it.label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      closeContextMenu();
      it.action();
    });
    menu.append(b);
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  document.body.append(menu);
  menuEl = menu;

  // 画面外にはみ出す場合は内側へ寄せる。
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = `${window.innerWidth - r.width - 8}px`;
  if (r.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - r.height - 8}px`;
}

// 外側クリック・フォーカス喪失・リサイズで閉じる。
document.addEventListener("click", closeContextMenu);
window.addEventListener("blur", closeContextMenu);
window.addEventListener("resize", closeContextMenu);
