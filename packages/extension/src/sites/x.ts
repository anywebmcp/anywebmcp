import { mountSite } from "@anywebmcp/common";
import xSite, { installNetworkCapture } from "@anywebmcp/site-x";

installNetworkCapture();
mountSite(xSite);
