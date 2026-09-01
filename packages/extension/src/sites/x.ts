import { mountSite } from "@openwebmcp/common";
import xSite, { installNetworkCapture } from "@openwebmcp/site-x";

installNetworkCapture();
mountSite(xSite);
