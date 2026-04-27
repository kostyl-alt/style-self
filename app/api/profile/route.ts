import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import type { BodyInfo, BodyProfile } from "@/types/index";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const { data, error } = await supabase
      .from("users")
      .select("display_name, height, weight, body_type, body_tendency, weight_center, shoulder_width, upper_body_thickness, muscle_type, leg_length, preferred_fit, style_impression, emphasize_parts, hide_parts, fit_recommendation, body_profile")
      .eq("id", user.id)
      .single() as unknown as {
        data: {
          display_name: string | null;
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
          body_profile: BodyProfile | null;
        } | null;
        error: { message: string } | null;
      };

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)  return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

    const bodyInfo: BodyInfo = {
      height:              data.height,
      weight:              data.weight,
      bodyType:            data.body_type            as BodyInfo["bodyType"],
      bodyTendency:        data.body_tendency         as BodyInfo["bodyTendency"],
      weightCenter:        data.weight_center         as BodyInfo["weightCenter"],
      shoulderWidth:       data.shoulder_width        as BodyInfo["shoulderWidth"],
      upperBodyThickness:  data.upper_body_thickness  as BodyInfo["upperBodyThickness"],
      muscleType:          data.muscle_type           as BodyInfo["muscleType"],
      legLength:           data.leg_length            as BodyInfo["legLength"],
      preferredFit:        data.preferred_fit         as BodyInfo["preferredFit"],
      styleImpression:     data.style_impression      as BodyInfo["styleImpression"],
      emphasizeParts:      (data.emphasize_parts ?? []) as BodyInfo["emphasizeParts"],
      hideParts:           (data.hide_parts ?? [])    as BodyInfo["hideParts"],
      fitRecommendation:   data.fit_recommendation,
    };

    return NextResponse.json({ displayName: data.display_name, bodyInfo, bodyProfile: data.body_profile ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

    const body = await request.json() as {
      displayName?: string;
      bodyInfo?: Partial<BodyInfo>;
      bodyProfile?: BodyProfile | null;
    };

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.displayName !== undefined) updateData.display_name = body.displayName;
    if (body.bodyInfo) {
      const b = body.bodyInfo;
      if (b.height             !== undefined) updateData.height              = b.height;
      if (b.weight             !== undefined) updateData.weight              = b.weight;
      if (b.bodyType           !== undefined) updateData.body_type           = b.bodyType;
      if (b.bodyTendency       !== undefined) updateData.body_tendency       = b.bodyTendency;
      if (b.weightCenter       !== undefined) updateData.weight_center       = b.weightCenter;
      if (b.shoulderWidth      !== undefined) updateData.shoulder_width      = b.shoulderWidth;
      if (b.upperBodyThickness !== undefined) updateData.upper_body_thickness = b.upperBodyThickness;
      if (b.muscleType         !== undefined) updateData.muscle_type         = b.muscleType;
      if (b.legLength          !== undefined) updateData.leg_length          = b.legLength;
      if (b.preferredFit       !== undefined) updateData.preferred_fit       = b.preferredFit;
      if (b.styleImpression    !== undefined) updateData.style_impression    = b.styleImpression;
      if (b.emphasizeParts     !== undefined) updateData.emphasize_parts     = b.emphasizeParts;
      if (b.hideParts          !== undefined) updateData.hide_parts          = b.hideParts;
    }
    if (body.bodyProfile !== undefined) updateData.body_profile = body.bodyProfile;

    const { error } = await supabase
      .from("users")
      .update(updateData as never)
      .eq("id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
