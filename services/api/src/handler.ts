import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME!;
const API_KEY = process.env.API_KEY!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CODE_PATTERN = /^[a-z0-9]{6,12}$/;
const MAX_PAYLOAD_BYTES = 100 * 1024;
const TTL_DAYS = 30;

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // API key check — stops casual bots. Not a security boundary (key is in
  // the deployed config.json), but prevents drive-by traffic.
  if (event.headers["x-api-key"] !== API_KEY) {
    return respond(403, { error: "Forbidden" });
  }

  const method = event.requestContext.http.method;
  const rawCode = event.pathParameters?.code;
  if (!rawCode) return respond(400, { error: "Missing sync code" });

  const code = rawCode.toLowerCase();
  if (!CODE_PATTERN.test(code)) {
    return respond(400, { error: "Invalid sync code (6-12 lowercase alphanumeric)" });
  }

  switch (method) {
    case "GET":
      return handleGet(code);
    case "PUT":
      return handlePut(code, event);
    case "DELETE":
      return handleDelete(code, event);
    default:
      return respond(405, { error: "Method not allowed" });
  }
}

async function handleGet(code: string): Promise<APIGatewayProxyResultV2> {
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { code },
      ProjectionExpression: "#d, updatedAt",
      ExpressionAttributeNames: { "#d": "data" },
    }),
  );
  if (!result.Item) return respond(404, { error: "Not found" });
  return respond(200, {
    data: result.Item.data as string,
    updatedAt: result.Item.updatedAt as string,
  });
}

async function handlePut(
  code: string,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const body = event.body;
  if (!body) return respond(400, { error: "Missing body" });
  if (body.length > MAX_PAYLOAD_BYTES) {
    return respond(413, { error: "Payload too large (max 100KB)" });
  }

  const writeToken = event.headers["x-write-token"];
  if (!writeToken) return respond(400, { error: "Missing write token" });

  // If an item already exists, verify write token to prevent vandalism.
  const existing = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { code },
      ProjectionExpression: "writeToken",
    }),
  );
  if (existing.Item && existing.Item.writeToken !== writeToken) {
    return respond(403, { error: "Invalid write token" });
  }

  const now = new Date();
  await ddb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        code,
        data: body,
        writeToken,
        updatedAt: now.toISOString(),
        expiresAt: Math.floor(now.getTime() / 1000) + TTL_DAYS * 86400,
      },
    }),
  );
  return respond(200, { updatedAt: now.toISOString() });
}

async function handleDelete(
  code: string,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const writeToken = event.headers["x-write-token"];
  if (!writeToken) return respond(400, { error: "Missing write token" });

  const existing = await ddb.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { code },
      ProjectionExpression: "writeToken",
    }),
  );
  if (!existing.Item) return respond(404, { error: "Not found" });
  if (existing.Item.writeToken !== writeToken) {
    return respond(403, { error: "Invalid write token" });
  }

  await ddb.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { code } }));
  return respond(200, { ok: true });
}

function respond(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
