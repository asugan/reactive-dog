// Supabase Edge Function to generate PDF reports for behaviorists
// Uses deno-pdf-lib for PDF generation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, timeRange } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    // Calculate date range
    const daysBack = timeRange === "7days" ? 7 : timeRange === "30days" ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Fetch dog profile
    const { data: dogProfile, error: dogError } = await supabaseClient
      .from("dog_profiles")
      .select("*")
      .eq("owner_id", userId)
      .single();

    if (dogError) {
      console.error("Error fetching dog profile:", dogError);
    }

    // Fetch trigger logs
    const { data: logs, error: logsError } = await supabaseClient
      .from("trigger_logs")
      .select("*")
      .eq("owner_id", userId)
      .gte("logged_at", cutoffDate.toISOString())
      .order("logged_at", { ascending: false });

    if (logsError) {
      console.error("Error fetching logs:", logsError);
    }

    // Fetch walks
    const { data: walks, error: walksError } = await supabaseClient
      .from("walks")
      .select("*")
      .eq("owner_id", userId)
      .gte("started_at", cutoffDate.toISOString())
      .order("started_at", { ascending: false });

    if (walksError) {
      console.error("Error fetching walks:", walksError);
    }

    // Generate HTML content for PDF
    const htmlContent = generateReportHTML({
      dogProfile,
      logs: logs || [],
      walks: walks || [],
      timeRange,
      daysBack,
      generatedAt: new Date().toLocaleString(),
    });

    // For now, return HTML content (can be converted to PDF on client or using a service)
    // In production, you'd use a PDF generation service or library
    return new Response(
      JSON.stringify({
        success: true,
        html: htmlContent,
        reportData: {
          dogName: dogProfile?.name || "Unknown",
          totalLogs: logs?.length || 0,
          totalWalks: walks?.length || 0,
          dateRange: `Last ${daysBack} days`,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateReportHTML({ dogProfile, logs, walks, timeRange, daysBack, generatedAt }: {
  dogProfile: any;
  logs: any[];
  walks: any[];
  timeRange: string;
  daysBack: number;
  generatedAt: string;
}) {
  const triggerLabels: { [key: string]: string } = {
    Dog_OffLeash: "Dog (Off-leash)",
    Dog_OnLeash: "Dog (On-leash)",
    Human: "Human",
    Bike: "Bike",
    Car: "Car",
    Noise: "Noise",
    Other: "Other",
  };

  const techniqueLabels: { [key: string]: string } = {
    U_Turn: "U-Turn",
    Find_It: "Find It",
    LAT: "Look at That",
    Other: "Other",
  };

  // Calculate stats
  const avgSeverity = logs.length > 0
    ? (logs.reduce((sum, log) => sum + (log.severity || 0), 0) / logs.length).toFixed(1)
    : "0";

  const triggerCounts: { [key: string]: number } = {};
  logs.forEach(log => {
    triggerCounts[log.trigger_type] = (triggerCounts[log.trigger_type] || 0) + 1;
  });

  const mostCommonTrigger = Object.entries(triggerCounts)
    .sort((a, b) => b[1] - a[1])[0];

  const avgWalkRating = walks.length > 0
    ? (walks.reduce((sum, walk) => sum + (walk.success_rating || 0), 0) / walks.length).toFixed(1)
    : "0";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reactive Dog Training Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #7C3AED;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #7C3AED;
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header p {
      color: #666;
      font-size: 14px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #1F2937;
      font-size: 20px;
      margin-bottom: 15px;
      border-left: 4px solid #7C3AED;
      padding-left: 15px;
    }
    .dog-info {
      background: #F9FAFB;
      padding: 20px;
      border-radius: 12px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }
    .dog-info-item {
      display: flex;
      justify-content: space-between;
    }
    .dog-info-label {
      font-weight: 600;
      color: #6B7280;
    }
    .dog-info-value {
      color: #1F2937;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-box {
      background: #F9FAFB;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-box h3 {
      font-size: 24px;
      color: #7C3AED;
      margin-bottom: 5px;
    }
    .stat-box p {
      font-size: 12px;
      color: #6B7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 13px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #E5E7EB;
    }
    th {
      background: #F3F4F6;
      font-weight: 600;
      color: #374151;
    }
    .severity-1 { color: #10B981; }
    .severity-2 { color: #10B981; }
    .severity-3 { color: #F59E0B; }
    .severity-4 { color: #EF4444; }
    .severity-5 { color: #DC2626; font-weight: bold; }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      font-size: 12px;
      color: #9CA3AF;
    }
    .disclaimer {
      background: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 15px;
      margin-top: 30px;
      font-size: 12px;
      color: #92400E;
    }
    .walk-summary {
      background: #ECFDF5;
      border-left: 4px solid #10B981;
      padding: 15px;
      margin-bottom: 15px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reactive Dog Training Report</h1>
    <p>Professional Summary for Behaviorists | Generated: ${generatedAt}</p>
    <p>Reporting Period: Last ${daysBack} days</p>
  </div>

  <div class="section">
    <h2>Dog Profile</h2>
    <div class="dog-info">
      <div class="dog-info-item">
        <span class="dog-info-label">Name:</span>
        <span class="dog-info-value">${dogProfile?.name || "N/A"}</span>
      </div>
      <div class="dog-info-item">
        <span class="dog-info-label">Breed:</span>
        <span class="dog-info-value">${dogProfile?.breed || "N/A"}</span>
      </div>
      <div class="dog-info-item">
        <span class="dog-info-label">Age:</span>
        <span class="dog-info-value">${dogProfile?.age ? dogProfile.age + " years" : "N/A"}</span>
      </div>
      <div class="dog-info-item">
        <span class="dog-info-label">Weight:</span>
        <span class="dog-info-value">${dogProfile?.weight ? dogProfile.weight + " kg" : "N/A"}</span>
      </div>
      <div class="dog-info-item">
        <span class="dog-info-label">Reactivity Level:</span>
        <span class="dog-info-value">${dogProfile?.reactivity_level ? dogProfile.reactivity_level + "/5" : "N/A"}</span>
      </div>
      <div class="dog-info-item">
        <span class="dog-info-label">Training Method:</span>
        <span class="dog-info-value">${dogProfile?.training_method || "N/A"}</span>
      </div>
    </div>
    ${dogProfile?.triggers?.length > 0 ? `
    <div style="margin-top: 15px;">
      <span class="dog-info-label">Identified Triggers:</span>
      <p style="margin-top: 5px;">${dogProfile.triggers.join(", ")}</p>
    </div>
    ` : ""}
  </div>

  <div class="section">
    <h2>Summary Statistics</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <h3>${logs.length}</h3>
        <p>Total Reactions Logged</p>
      </div>
      <div class="stat-box">
        <h3>${avgSeverity}</h3>
        <p>Average Severity (1-5)</p>
      </div>
      <div class="stat-box">
        <h3>${walks.length}</h3>
        <p>BAT Training Sessions</p>
      </div>
    </div>
    ${mostCommonTrigger ? `
    <div class="stat-box" style="background: #FEF3C7;">
      <h3 style="color: #D97706;">${triggerLabels[mostCommonTrigger[0]] || mostCommonTrigger[0]}</h3>
      <p>Most Common Trigger (${mostCommonTrigger[1]} occurrences)</p>
    </div>
    ` : ""}
    ${walks.length > 0 ? `
    <div class="walk-summary" style="margin-top: 15px;">
      <strong>Average Walk Success Rating:</strong> ${avgWalkRating}/5
    </div>
    ` : ""}
  </div>

  ${logs.length > 0 ? `
  <div class="section">
    <h2>Reaction Logs Detail</h2>
    <table>
      <thead>
        <tr>
          <th>Date & Time</th>
          <th>Trigger Type</th>
          <th>Severity</th>
          <th>Distance</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${logs.slice(0, 20).map(log => `
        <tr>
          <td>${new Date(log.logged_at).toLocaleString()}</td>
          <td>${triggerLabels[log.trigger_type] || log.trigger_type}</td>
          <td class="severity-${log.severity}">${log.severity}/5</td>
          <td>${log.distance_meters ? log.distance_meters + "m" : "N/A"}</td>
          <td>${log.notes || "-"}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    ${logs.length > 20 ? `<p style="margin-top: 10px; font-style: italic; color: #6B7280;">... and ${logs.length - 20} more entries</p>` : ""}
  </div>
  ` : ""}

  ${walks.length > 0 ? `
  <div class="section">
    <h2>BAT Training Sessions</h2>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Duration</th>
          <th>Success Rating</th>
          <th>Technique Used</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${walks.map(walk => {
          const duration = walk.ended_at 
            ? Math.round((new Date(walk.ended_at).getTime() - new Date(walk.started_at).getTime()) / 60000)
            : "In Progress";
          return `
        <tr>
          <td>${new Date(walk.started_at).toLocaleDateString()}</td>
          <td>${typeof duration === "number" ? duration + " min" : duration}</td>
          <td>${walk.success_rating ? walk.success_rating + "/5" : "N/A"}</td>
          <td>${walk.technique_used ? techniqueLabels[walk.technique_used] : "N/A"}</td>
          <td>${walk.notes || "-"}</td>
        </tr>
        `}).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <div class="disclaimer">
    <strong>Important:</strong> This report is generated from user-logged data in the Reactive Dog Training App. 
    It is intended to assist behaviorists and trainers but should not replace professional assessment. 
    For dogs with severe aggression or bite history, please consult a certified veterinary behaviorist.
  </div>

  <div class="footer">
    <p>Generated by Reactive Dog Training App</p>
    <p>For professional use only</p>
  </div>
</body>
</html>`;
}
