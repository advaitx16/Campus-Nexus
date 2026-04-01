/**
 * Campus Nexus v2.0 - Database Type Definitions
 * Auto-generated from schema definitions
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          univ_email: string
          real_name: string | null
          display_name: string | null
          alias_name: string
          trust_score: number
          cc_balance: number
          verification_data: Json | null
          role: 'STUDENT' | 'ADMIN' | 'MODERATOR'
          status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'RESTRICTED' | 'BANNED' | 'SHADOW_BANNED'
          college_id: string
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['users']['Row'], 'id'>>
      }
      products: {
        Row: {
          id: string
          seller_id: string
          type: 'SELL' | 'RENT' | 'REQ'
          title: string
          description: string | null
          category: string | null
          tags: string[] | null
          condition_rating: number | null
          price: number | null
          rental_price_daily: number | null
          rental_price_weekly: number | null
          rental_price_semester: number | null
          ai_metadata: Json | null
          status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'RESERVED' | 'SHADOW_BANNED'
          priority_score: number
          views: number
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Database['public']['Tables']['products']['Row'], 'id'>>
      }
      rentals: {
        Row: {
          id: string
          product_id: string
          renter_id: string
          escrow_status: 'HELD' | 'RELEASED' | 'REFUNDED'
          deposit_id: string | null
          deposit_amount: number | null
          start_date: string
          expected_return_date: string
          actual_return_date: string | null
          handover_qr_hash: string | null
          status: 'PENDING' | 'ACTIVE' | 'RETURNED' | 'OVERDUE' | 'DISPUTE'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['rentals']['Row'], 'id' | 'created_at' | 'updated_at' | 'actual_return_date' | 'handover_qr_hash'>
        Update: Partial<Omit<Database['public']['Tables']['rentals']['Row'], 'id'>>
      }
      ledger: {
        Row: {
          id: string
          transaction_hash: string
          from_user: string | null
          to_user: string | null
          points_delta: number
          reason: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ledger']['Row'], 'id' | 'created_at'>
        // Updates and deletes are not allowed on the ledger based on triggers
      }
      community_feed: {
        Row: {
          id: string
          author_id: string
          channel: string
          content: string
          is_anon: boolean
          sentiment_score: number | null
          moderation_status: 'CLEAN' | 'FLAGGED' | 'HIDDEN'
          created_at: string
          deleted_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['community_feed']['Row'], 'id' | 'created_at' | 'deleted_at'>
        Update: Partial<Omit<Database['public']['Tables']['community_feed']['Row'], 'id'>>
      }
    }
    Views: {
      leaderboard_top_sellers: {
        Row: {
          id: string
          real_name: string | null
          alias_name: string
          trust_score: number
          college_id: string
          total_sales: number
          total_revenue: number
        }
      }
    }
    Functions: {
      update_trust_score: {
        Args: { user_id: string; score_increment: number }
        Returns: number
      }
    }
  }
}
