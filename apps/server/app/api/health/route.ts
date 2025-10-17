/**
 * REMINDER: After creating or modifying this component,
 * update BUILD_STATUS.md with the component details.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'evenly-server',
  });
}
