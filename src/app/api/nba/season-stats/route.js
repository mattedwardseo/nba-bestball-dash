    // This version fetches pre-processed data directly from the Supabase database.

    import { NextResponse } from 'next/server';
    import { supabase } from '@/lib/supabaseClient'; // Import the Supabase client utility (using alias)

    export async function GET(request) {
        const { searchParams } = new URL(request.url);
        const season = searchParams.get('season') || '2024'; // Default to 2024 season
        const seasonNum = parseInt(season, 10);

        if (isNaN(seasonNum)) {
             return NextResponse.json({ message: 'Invalid season parameter' }, { status: 400 });
        }

        console.log(`API Route: Fetching pre-processed stats for season ${seasonNum} from Supabase...`);

        try {
            // Query your Supabase table
            // Select all columns (*) from 'player_season_stats' table
            // where the 'season' column matches the requested seasonNum
            const { data, error } = await supabase
                .from('player_season_stats') // Your table name
                .select('*')                 // Select all columns
                .eq('season', seasonNum);    // Filter by season

            // Handle potential errors from the Supabase query
            if (error) {
                console.error("Supabase query error:", error);
                // Throwing the error will be caught by the outer catch block
                throw error;
            }

            console.log(`API Route: Successfully fetched ${data?.length || 0} records from Supabase for season ${seasonNum}.`);

            // Return the data fetched from Supabase
            // Note: 'data' will be an empty array [] if the table is empty or RLS prevents access
            return NextResponse.json({ data: data || [], season: seasonNum });

        } catch (error) {
            console.error("Error fetching stats from Supabase:", error.message);
            // Return a generic server error response
            return NextResponse.json(
                { message: `Error fetching stats from database: ${error.message}` },
                { status: 500 }
            );
        }
    }