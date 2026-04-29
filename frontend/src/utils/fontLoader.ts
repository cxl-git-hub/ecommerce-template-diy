import { assetApi } from '@/api';

// 已加载的字体集合，避免重复注入
const loadedFonts = new Set<string>();

/**
 * 动态加载单个字体：通过创建 style 标签注入 @font-face
 */
export function loadFont(fontFamily: string, fontUrl: string): void {
  const key = `${fontFamily}@${fontUrl}`;
  if (loadedFonts.has(key)) return;
  loadedFonts.add(key);

  const style = document.createElement('style');
  style.dataset.fontFamily = fontFamily;
  style.textContent = `
@font-face {
  font-family: '${fontFamily}';
  src: url('${fontUrl}') format('${guessFormat(fontUrl)}');
  font-display: swap;
}
`;
  document.head.appendChild(style);
}

/**
 * 批量加载所有公共字体
 */
export async function loadAllFonts(): Promise<void> {
  try {
    const res = await assetApi.listFonts();
    const fonts = res.data as { font_family: string | null; file_path: string }[];
    for (const font of fonts) {
      if (font.font_family && font.file_path) {
        const url = font.file_path.startsWith('/') ? font.file_path : `/${font.file_path}`;
        loadFont(font.font_family, url);
      }
    }
  } catch (err) {
    console.warn('字体列表加载失败', err);
  }
}

/**
 * 根据文件扩展名猜测 font-face format
 */
function guessFormat(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'woff2': return 'woff2';
    case 'woff': return 'woff';
    case 'ttf': return 'truetype';
    case 'otf': return 'opentype';
    default: return 'truetype';
  }
}
