import { authenticateWebsiteAdmin, getWebsiteAdminFromRequest, setWebsiteAdminSession, WEBSITE_ADMIN_SESSION_COOKIE } from "../server/websiteAdminAuth";

const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!password) throw new Error("INITIAL_ADMIN_PASSWORD must be supplied securely.");

const user = await authenticateWebsiteAdmin("bruce@oriolemarketing.com", password);
if (!user || user.role !== "admin") throw new Error("Initial website administrator could not authenticate.");

let issuedCookie = "";
const request = { protocol: "https", headers: {} } as never;
const response = {
  cookie: (name: string, value: string) => {
    if (name === WEBSITE_ADMIN_SESSION_COOKIE) issuedCookie = value;
  },
} as never;
setWebsiteAdminSession(response, request, user);
if (!issuedCookie) throw new Error("Website administrator session cookie was not issued.");

const hydratedUser = await getWebsiteAdminFromRequest({ headers: { cookie: `${WEBSITE_ADMIN_SESSION_COOKIE}=${issuedCookie}` } } as never);
if (!hydratedUser || hydratedUser.openId !== user.openId || hydratedUser.role !== "admin") {
  throw new Error("Website administrator session could not be verified.");
}

console.log(`Verified local sign-in and session for active administrator: ${hydratedUser.email}`);
