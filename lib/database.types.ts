/**
 * Supabase `Database` shape for createClient<Database>().
 * Must satisfy GenericSchema: each table has Row/Insert/Update + Relationships[];
 * schema includes Tables, Views, and Functions (see @supabase/supabase-js).
 */
export type Database = {
  public: {
    Tables: {
      bandit: {
        Row: {
          id: string;
          name: string;
          family_name: string;
          age: number;
          city: string;
          occupation: string;
          image_url: string;
          face_image_url: string | null;
          rating: number;
          is_liked: boolean;
          icon: string | null;
          created_at: string;
          description: string | null;
          why_follow: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          family_name: string;
          age: number;
          city: string;
          occupation: string;
          image_url: string;
          face_image_url?: string | null;
          rating: number;
          is_liked?: boolean;
          icon?: string | null;
          created_at?: string;
          description: string | null;
          why_follow: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          family_name?: string;
          age?: number;
          city?: string;
          occupation?: string;
          image_url?: string;
          face_image_url?: string | null;
          rating?: number;
          is_liked?: boolean;
          icon?: string | null;
          created_at?: string;
          description?: string | null;
          why_follow?: string | null;
        };
        Relationships: [];
      };
      bandit_event: {
        Row: {
          id: string;
          created_at: string;
          bandit_id: string;
          event_id: string;
          personal_tip: string | null;
          recommendation_place_photo_url: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          bandit_id: string;
          event_id: string;
          personal_tip?: string | null;
          recommendation_place_photo_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          bandit_id?: string;
          event_id?: string;
          personal_tip?: string | null;
          recommendation_place_photo_url?: string | null;
        };
        Relationships: [];
      };
      event: {
        Row: {
          id: string;
          name: string;
          genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
          start_time: string;
          end_time: string;
          timing_info: string;
          location_lat: number;
          location_lng: number;
          address: string;
          city: string;
          neighborhood: string;
          description: string;
          rating: number;
          created_at: string;
          image_url: string;
          link: string;
          image_gallery: string | null;
          google_place_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          genre: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
          start_time: string;
          end_time: string;
          timing_info: string;
          location_lat: number;
          location_lng: number;
          address: string;
          city: string;
          neighborhood: string;
          description: string;
          rating: number;
          created_at?: string;
          image_url: string;
          link: string;
          image_gallery?: string | null;
          google_place_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          genre?: 'Food' | 'Culture' | 'Nightlife' | 'Shopping' | 'Coffee';
          start_time?: string;
          end_time?: string;
          timing_info?: string;
          location_lat?: number;
          location_lng?: number;
          address?: string;
          city?: string;
          neighborhood?: string;
          description?: string;
          rating?: number;
          created_at?: string;
          image_url?: string;
          link?: string;
          image_gallery?: string | null;
          google_place_id?: string | null;
        };
        Relationships: [];
      };
      event_user_likes: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_bandit: {
        Row: {
          user_id: string;
          bandit_id: string;
          review: string;
          rating: number;
          user_name: string;
        };
        Insert: {
          user_id: string;
          bandit_id: string;
          review: string;
          rating: number;
          user_name: string;
        };
        Update: {
          user_id?: string;
          bandit_id?: string;
          review?: string;
          rating?: number;
          user_name?: string;
        };
        Relationships: [];
      };
      bandit_user_likes: {
        Row: {
          user_id: string;
          bandit_id: string;
        };
        Insert: {
          user_id: string;
          bandit_id: string;
        };
        Update: {
          user_id?: string;
          bandit_id?: string;
        };
        Relationships: [];
      };
      bandit_tags: {
        Row: {
          bandit_id: string;
          tag_id: string;
        };
        Insert: {
          bandit_id: string;
          tag_id: string;
        };
        Update: {
          bandit_id?: string;
          tag_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      network_signal: {
        Row: {
          id: string;
          body: string;
          brand: string;
          sort_index: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          body: string;
          brand?: string;
          sort_index: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          body?: string;
          brand?: string;
          sort_index?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      signal_delivery: {
        Row: {
          id: string;
          sender_user_id: string | null;
          receiver_user_id: string;
          signal_id: string;
          hotel_slug: string;
          assigned_at: string;
          reveal_status: string;
          revealed_at: string | null;
          delivery_status: string;
          thread_notification_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sender_user_id?: string | null;
          receiver_user_id: string;
          signal_id: string;
          hotel_slug?: string;
          assigned_at?: string;
          reveal_status?: string;
          revealed_at?: string | null;
          delivery_status?: string;
          thread_notification_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sender_user_id?: string | null;
          receiver_user_id?: string;
          signal_id?: string;
          hotel_slug?: string;
          assigned_at?: string;
          reveal_status?: string;
          revealed_at?: string | null;
          delivery_status?: string;
          thread_notification_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      signal_thread_message: {
        Row: {
          id: string;
          signal_delivery_id: string;
          author_user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          signal_delivery_id: string;
          author_user_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          signal_delivery_id?: string;
          author_user_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profile: {
        Row: {
          id: string;
          name: string;
          interests: string[];
          city: string;
          location_permission: boolean;
          hotel_id: string | null;
          entry_source: string | null;
          created_at: string;
          updated_at: string;
          avatar_url: string | null;
          current_signal_id: string | null;
          last_signal_at: string | null;
          signal_history_ids: string[];
        };
        Insert: {
          id: string;
          name?: string;
          interests?: string[];
          city?: string;
          location_permission?: boolean;
          hotel_id?: string | null;
          entry_source?: string | null;
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
          current_signal_id?: string | null;
          last_signal_at?: string | null;
          signal_history_ids?: string[];
        };
        Update: {
          id?: string;
          name?: string;
          interests?: string[];
          city?: string;
          location_permission?: boolean;
          hotel_id?: string | null;
          entry_source?: string | null;
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
          current_signal_id?: string | null;
          last_signal_at?: string | null;
          signal_history_ids?: string[];
        };
        Relationships: [];
      };
      app_public_config: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scam_alerts: {
        Row: {
          id: string;
          city: string;
          location: string;
          title: string;
          description: string;
          reported_by: string | null;
          created_at: string;
          image_url: string | null;
          category: string;
          severity: number;
          location_lat: number | null;
          location_lng: number | null;
          admin_verified: boolean;
          moderation_status: string;
        };
        Insert: {
          id?: string;
          city: string;
          location: string;
          title: string;
          description: string;
          reported_by?: string | null;
          created_at?: string;
          image_url?: string | null;
          category?: string;
          severity?: number;
          location_lat?: number | null;
          location_lng?: number | null;
          admin_verified?: boolean;
          moderation_status?: string;
        };
        Update: {
          id?: string;
          city?: string;
          location?: string;
          title?: string;
          description?: string;
          reported_by?: string | null;
          created_at?: string;
          image_url?: string | null;
          category?: string;
          severity?: number;
          location_lat?: number | null;
          location_lng?: number | null;
          admin_verified?: boolean;
          moderation_status?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          reference_id: string | null;
          reference_type: string | null;
          is_read: boolean;
          created_at: string;
          ask_target_bandit_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          created_at?: string;
          ask_target_bandit_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          message?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          is_read?: boolean;
          created_at?: string;
          ask_target_bandit_id?: string | null;
        };
        Relationships: [];
      };
      pilot_thread_identity: {
        Row: {
          thread_root_notification_id: string;
          recipient_user_id: string;
          sender_persona_bandit_id: string | null;
          sender_persona_display_name: string;
          sender_persona_avatar_url: string;
          opening_message: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          thread_root_notification_id: string;
          recipient_user_id: string;
          sender_persona_bandit_id?: string | null;
          sender_persona_display_name: string;
          sender_persona_avatar_url?: string;
          opening_message: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          thread_root_notification_id?: string;
          recipient_user_id?: string;
          sender_persona_bandit_id?: string | null;
          sender_persona_display_name?: string;
          sender_persona_avatar_url?: string;
          opening_message?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_name: string;
          reference_type: string | null;
          reference_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_name: string;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          event_name?: string;
          reference_type?: string | null;
          reference_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      spots: {
        Row: {
          id: string;
          bandit_id: string;
          name: string;
          address: string | null;
          city: string | null;
          neighborhood: string | null;
          category: string | null;
          description: string | null;
          image_url: string | null;
          image_gallery: string | null;
          location_lat: number | null;
          location_lng: number | null;
          google_place_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          bandit_id: string;
          name: string;
          address?: string | null;
          city?: string | null;
          neighborhood?: string | null;
          category?: string | null;
          description?: string | null;
          image_url?: string | null;
          image_gallery?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          google_place_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          bandit_id?: string;
          name?: string;
          address?: string | null;
          city?: string | null;
          neighborhood?: string | null;
          category?: string | null;
          description?: string | null;
          image_url?: string | null;
          image_gallery?: string | null;
          location_lat?: number | null;
          location_lng?: number | null;
          google_place_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      trails: {
        Row: {
          id: string;
          title: string;
          description: string;
          mood: string;
          duration: string;
          bandit_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          mood: string;
          duration: string;
          bandit_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          mood?: string;
          duration?: string;
          bandit_id?: string;
        };
        Relationships: [];
      };
      trail_stops: {
        Row: {
          id: string;
          trail_id: string;
          spot_id: string | null;
          position: number;
          note: string | null;
          stop_name: string;
        };
        Insert: {
          id?: string;
          trail_id: string;
          spot_id?: string | null;
          position: number;
          note?: string | null;
          stop_name: string;
        };
        Update: {
          id?: string;
          trail_id?: string;
          spot_id?: string | null;
          position?: number;
          note?: string | null;
          stop_name?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
