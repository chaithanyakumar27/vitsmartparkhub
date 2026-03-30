import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, boundary, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (mode === "detect_boundary") {
      systemPrompt = `You are a parking lot analysis AI. Analyze the image and detect parking boundaries/lines/zones. Return a JSON response with this exact structure:
{
  "boundaries": [
    { "x": <percentage 0-100 from left>, "y": <percentage 0-100 from top>, "width": <percentage of image width>, "height": <percentage of image height>, "label": "Parking Zone A" }
  ],
  "description": "<brief description of the parking layout>"
}
If no clear parking boundaries are visible, infer reasonable parking zones based on the scene layout. Always return at least one boundary.`;
      userPrompt = "Detect all parking boundaries, lanes, and zones in this parking lot image. Identify where vehicles should park.";
    } else {
      const boundaryInfo = boundary
        ? `A parking boundary is defined at: x=${boundary.x}%, y=${boundary.y}%, width=${boundary.width}%, height=${boundary.height}% of the image.`
        : "No parking boundary is defined. Analyze the overall scene.";

      systemPrompt = `You are a vehicle detection and parking analysis AI. Analyze the image for vehicles and their positioning. Return a JSON response with this exact structure:
{
  "vehicles": [
    {
      "type": "<car|motorcycle|truck|van|suv>",
      "model_guess": "<estimated model or 'unknown'>",
      "confidence": <0.0-1.0>,
      "bounding_box": { "x": <percentage 0-100 from left>, "y": <percentage 0-100 from top>, "width": <percentage of image width>, "height": <percentage of image height> },
      "status": "<inside|outside|crossing>",
      "status_description": "<brief explanation>"
    }
  ],
  "total_vehicles": <number>,
  "scene_description": "<brief description of the parking scene>"
}
${boundaryInfo}
For each vehicle, determine if it is fully inside the boundary (inside), completely outside (outside), or partially crossing the boundary line (crossing).
If no boundary is provided, set status to "unknown".`;
      userPrompt = "Detect all vehicles in this image. For each vehicle, identify its type, estimate position as percentage coordinates, and determine if it is properly parked within the defined boundary.";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Extract JSON from response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: "Could not parse AI response" };
    } catch {
      parsed = { raw: content, error: "JSON parse failed" };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
