export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          style_axis: Json | null;
          onboarding_completed: boolean;
          height: number | null;
          weight: number | null;
          body_type: string | null;
          body_tendency: string | null;
          weight_center: string | null;
          shoulder_width: string | null;
          upper_body_thickness: string | null;
          muscle_type: string | null;
          leg_length: string | null;
          preferred_fit: string | null;
          style_impression: string | null;
          emphasize_parts: string[] | null;
          hide_parts: string[] | null;
          fit_recommendation: string | null;
          worldview: Json | null;
          style_analysis: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          style_axis?: Json | null;
          onboarding_completed?: boolean;
          height?: number | null;
          weight?: number | null;
          body_type?: string | null;
          body_tendency?: string | null;
          weight_center?: string | null;
          shoulder_width?: string | null;
          upper_body_thickness?: string | null;
          muscle_type?: string | null;
          leg_length?: string | null;
          preferred_fit?: string | null;
          style_impression?: string | null;
          emphasize_parts?: string[] | null;
          hide_parts?: string[] | null;
          fit_recommendation?: string | null;
          worldview?: Json | null;
          style_analysis?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          display_name?: string | null;
          style_axis?: Json | null;
          onboarding_completed?: boolean;
          height?: number | null;
          weight?: number | null;
          body_type?: string | null;
          body_tendency?: string | null;
          weight_center?: string | null;
          shoulder_width?: string | null;
          upper_body_thickness?: string | null;
          muscle_type?: string | null;
          leg_length?: string | null;
          preferred_fit?: string | null;
          style_impression?: string | null;
          emphasize_parts?: string[] | null;
          hide_parts?: string[] | null;
          fit_recommendation?: string | null;
          worldview?: Json | null;
          style_analysis?: Json | null;
          updated_at?: string;
        };
      };
      wardrobe_items: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          color: string;
          sub_color: string | null;
          material: string | null;
          fabric_texture: string | null;
          brand: string | null;
          season: string[];
          status: string;
          worldview_score: number | null;
          worldview_tags: string[] | null;
          silhouette: string | null;
          taste: string[] | null;
          image_url: string | null;
          tags: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          color: string;
          sub_color?: string | null;
          material?: string | null;
          fabric_texture?: string | null;
          brand?: string | null;
          season?: string[];
          status?: string;
          worldview_score?: number | null;
          worldview_tags?: string[] | null;
          silhouette?: string | null;
          taste?: string[] | null;
          image_url?: string | null;
          tags?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category?: string;
          color?: string;
          sub_color?: string | null;
          material?: string | null;
          fabric_texture?: string | null;
          brand?: string | null;
          season?: string[];
          status?: string;
          worldview_score?: number | null;
          worldview_tags?: string[] | null;
          silhouette?: string | null;
          taste?: string[] | null;
          image_url?: string | null;
          tags?: string[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      external_products: {
        Row: {
          id:                    string;
          source:                string;
          external_id:           string;
          product_url:           string | null;
          affiliate_url:         string | null;
          name:                  string;
          brand:                 string | null;
          price:                 number | null;
          image_url:             string | null;
          normalized_category:   string | null;
          normalized_color:      string | null;
          normalized_material:   string | null;
          normalized_silhouette: string | null;
          normalized_taste:      string[] | null;
          is_available:          boolean;
          imported_at:           string;
          synced_at:             string | null;
        };
        Insert: {
          id?:                    string;
          source:                 string;
          external_id:            string;
          product_url?:           string | null;
          affiliate_url?:         string | null;
          name:                   string;
          brand?:                 string | null;
          price?:                 number | null;
          image_url?:             string | null;
          normalized_category?:   string | null;
          normalized_color?:      string | null;
          normalized_material?:   string | null;
          normalized_silhouette?: string | null;
          normalized_taste?:      string[] | null;
          is_available?:          boolean;
          imported_at?:           string;
          synced_at?:             string | null;
        };
        Update: {
          product_url?:           string | null;
          affiliate_url?:         string | null;
          name?:                  string;
          brand?:                 string | null;
          price?:                 number | null;
          image_url?:             string | null;
          normalized_category?:   string | null;
          normalized_color?:      string | null;
          normalized_material?:   string | null;
          normalized_silhouette?: string | null;
          normalized_taste?:      string[] | null;
          is_available?:          boolean;
          synced_at?:             string | null;
        };
      };
      coordinates: {
        Row: {
          id: string;
          user_id: string;
          items: Json;
          color_story: string;
          belief_alignment: string;
          trend_note: string | null;
          occasion: string | null;
          saved_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          items: Json;
          color_story: string;
          belief_alignment: string;
          trend_note?: string | null;
          occasion?: string | null;
          saved_at?: string;
          created_at?: string;
        };
        Update: {
          items?: Json;
          color_story?: string;
          belief_alignment?: string;
          trend_note?: string | null;
          occasion?: string | null;
          saved_at?: string;
        };
      };
      brands: {
        Row: {
          id: string;
          name: string;
          name_ja: string | null;
          country: string;
          city: string | null;
          description: string;
          worldview_tags: string[];
          taste_tags: string[];
          era_tags: string[];
          scene_tags: string[];
          price_range: string;
          maniac_level: number;
          official_url: string | null;
          instagram_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_ja?: string | null;
          country: string;
          city?: string | null;
          description: string;
          worldview_tags?: string[];
          taste_tags?: string[];
          era_tags?: string[];
          scene_tags?: string[];
          price_range: string;
          maniac_level: number;
          official_url?: string | null;
          instagram_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          name_ja?: string | null;
          country?: string;
          city?: string | null;
          description?: string;
          worldview_tags?: string[];
          taste_tags?: string[];
          era_tags?: string[];
          scene_tags?: string[];
          price_range?: string;
          maniac_level?: number;
          official_url?: string | null;
          instagram_url?: string | null;
          is_active?: boolean;
        };
      };
      inspirations: {
        Row: {
          id: string;
          title: string;
          description: string;
          image_url: string | null;
          category: string;
          tags: string[];
          source_url: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          image_url?: string | null;
          category: string;
          tags?: string[];
          source_url?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          image_url?: string | null;
          category?: string;
          tags?: string[];
          source_url?: string | null;
          display_order?: number;
          is_active?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
