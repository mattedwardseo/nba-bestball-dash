    // src/lib/supabaseClient.js
    import { createClient } from '@supabase/supabase-js'

    // Fetch the Supabase URL and Anon Key from environment variables
    // IMPORTANT: Ensure these are set in your .env.local file
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Basic check to ensure variables are loaded
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase URL or Anon Key is missing from environment variables.");
        // You might throw an error here in a real application
        // throw new Error("Supabase URL or Anon Key is missing.");
    }

    // Create and export the Supabase client instance
    // We use the anon key here, assuming reads will be allowed via RLS policies
    // or that RLS is not yet strictly configured for reads.
    // For server-side operations needing full access (like inserts/updates later),
    // you might create a separate admin client using the service_role key.
    export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

    // You can add helper functions for database interactions here later if needed
    