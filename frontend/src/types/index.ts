// ==================== 用户 ====================
export interface User {
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ==================== 分类 ====================
export interface Category {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface CategoryCreate {
  name: string;
  sort_order?: number;
}

export interface CategoryUpdate {
  name?: string;
  sort_order?: number;
}

// ==================== 素材 ====================
export interface Asset {
  id: number;
  type: 'IMAGE' | 'FONT';
  owner_id: number | null;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  asset_metadata: { width: number; height: number } | null;
  font_family: string | null;
  font_categories: string[] | null;
  created_at: string;
}

// ==================== 模板 ====================
export interface Template {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  canvas_width: number;
  canvas_height: number;
  status: 'DRAFT' | 'PUBLISHED';
  published_version_id: number | null;
  created_by: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateDetail extends Template {
  current_draft_config: LayerConfig | null;
  versions: TemplateVersion[];
}

export interface TemplateCreate {
  title: string;
  category_id?: number;
  canvas_width?: number;
  canvas_height?: number;
}

export interface TemplateUpdate {
  title?: string;
  description?: string;
  category_id?: number;
}

// ==================== 模板版本 ====================
export interface TemplateVersion {
  id: number;
  template_id: number;
  version_number: number;
  description: string | null;
  config_data: LayerConfig;
  thumbnail_url: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_at: string;
  published_at: string | null;
}

// ==================== 用户设计 ====================
export interface UserDesign {
  id: number;
  user_id: number;
  template_version_id: number;
  config_data: LayerConfig;
  thumbnail_url: string | null;
  status: 'DRAFT' | 'EXPORTED';
  created_at: string;
  updated_at: string;
}

export interface UserDesignCreate {
  template_id: number;
}

export interface UserDesignConfigUpdate {
  config_data: LayerConfig;
}

export interface ExportRequest {
  format: 'png' | 'jpeg';
  quality: number;
}

// ==================== 图层配置 ====================
export interface LayerConfig {
  width: number;
  height: number;
  layers: Layer[];
}

export interface BaseLayer {
  id: string;
  type: 'background' | 'image_replace' | 'text';
  locked: boolean;
  visible: boolean;
  name: string;
  x: number;
  y: number;
  width: number | 'auto';
  height: number | 'auto';
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface BackgroundLayer extends BaseLayer {
  type: 'background';
  image_url: string;
  clip_path: string | null;
}

export interface ImageReplaceLayer extends BaseLayer {
  type: 'image_replace';
  replace_mode: 'normal' | 'ai_cutout';
  placeholder_url: string;
  user_image_url: string | null;
  clip: string | null;
}

export interface TextLayer extends BaseLayer {
  type: 'text';
  text: string;
  font_family: string;
  font_size: number;
  font_style: string;
  font_weight: string;
  text_decoration: string;
  line_height: number;
  letter_spacing: number;
  align: string;
  color: string;
  stroke: string | null;
  stroke_width: number;
  opacity: number;
}

export type Layer = BackgroundLayer | ImageReplaceLayer | TextLayer;
