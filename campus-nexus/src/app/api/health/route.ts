import { NextResponse } from 'next/server';
import { createClient } from '@/lib/server';

export async function GET() {
  const results: Record<string, any> = {};

  // 1. Check env variables
  results.env = {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing',
    supabase_key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? '✅ Set' : '❌ Missing',
    gemini_key: process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing',
    razorpay: process.env.RAZORPAY_KEY_ID !== 'rzp_test_demo' ? '✅ Real keys' : '⚠️ Demo keys',
  };

  // 2. Check Supabase connection
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      results.database = { status: '❌ Error', message: error.message, hint: error.hint || 'Run the migration SQL in Supabase dashboard' };
    } else {
      results.database = { status: '✅ Connected', tables: 'profiles table exists' };
    }
  } catch (e: any) {
    results.database = { status: '❌ Exception', message: e.message };
  }

  // 3. Check auth session
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    results.auth = user
      ? { status: '✅ Logged in', email: user.email, id: user.id }
      : { status: '⚠️ Not logged in', message: 'Visit /login to sign in — CC points require auth' };
  } catch (e: any) {
    results.auth = { status: '❌ Error', message: e.message };
  }

  // 4. Check community_feed table
  try {
    const supabase = await createClient();
    const { error } = await supabase.from('community_feed').select('count').limit(1);
    results.community_table = error
      ? { status: '❌ Missing', hint: 'Run campus_nexus_migration.sql in Supabase SQL editor' }
      : { status: '✅ Exists' };
  } catch (e: any) {
    results.community_table = { status: '❌ Error', message: e.message };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    overall: Object.values(results).every((r: any) => r.status?.startsWith('✅')) ? '✅ FULLY CONNECTED' : '⚠️ ISSUES FOUND',
    checks: results,
    fix_steps: [
      '1. Run campus_nexus_migration.sql in Supabase SQL Editor → https://supabase.com/dashboard/project/ypxgxxrllzzxtkmxamgz/sql/new',
      '2. Go to /login and sign up with your email',
      '3. After login, CC points will increment in real Supabase',
    ],
  }, { status: 200, headers: { 'Content-Type': 'application/json' } });
}
