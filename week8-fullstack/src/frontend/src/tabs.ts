// role="tablist" 的键盘契约。
//
// 展板里有多处 role="tablist" + role="tab"，但原本没有 tabpanel、aria-controls
// 和方向键处理。这是「半实现」：读屏会播报「第 1 项，共 6 项」并提示用户按方向键，
// 按下去却没有反应——比根本不声明 tab 角色更糟。
//
// 这里只补键盘部分；DOM 关联（id / aria-controls / aria-labelledby）由各调用处声明。
import type { KeyboardEvent } from "react";

export function tabKeyDown(
  tabIds: readonly string[],
  currentIndex: number,
  select: (index: number) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    const last = tabIds.length - 1;
    let target: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      target = currentIndex >= last ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      target = currentIndex <= 0 ? last : currentIndex - 1;
    } else if (event.key === "Home") {
      target = 0;
    } else if (event.key === "End") {
      target = last;
    }
    if (target === null) return;

    event.preventDefault();
    const next = target;
    select(next);
    // 切换只改属性、不重建节点，所以下一帧按 id 取到的就是目标 tab。
    requestAnimationFrame(() => document.getElementById(tabIds[next])?.focus());
  };
}
