import { el } from "./dom";

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
  const menu = el("div", "ctx-menu");
  for (const it of items) {
    const b = el("button", "ctx-item" + (it.danger ? " danger" : ""), it.label);
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

// ボタンの直下にメニューを開く（⋯ ボタンから開く場合）。
export function openMenuUnder(anchor: HTMLElement, items: MenuItem[]): void {
  const r = anchor.getBoundingClientRect();
  openContextMenu(items, r.left, r.bottom + 2);
}

// 外側クリック・フォーカス喪失・リサイズで閉じる。
document.addEventListener("click", closeContextMenu);
window.addEventListener("blur", closeContextMenu);
window.addEventListener("resize", closeContextMenu);
