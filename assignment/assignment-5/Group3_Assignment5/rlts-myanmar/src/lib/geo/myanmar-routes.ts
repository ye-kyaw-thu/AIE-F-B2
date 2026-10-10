// Road-following route geometry, generated offline via OSRM and baked in as static
// data — NOT fetched live. This file is the output of a one-time script
// (see the "Route geometry" note in ../../README.md) that:
//   1. Queried the public OSRM demo API (router.project-osrm.org) once for each
//      corridor's real driving route (Yangon->Muse: 1,095.8 km raw; Yangon->Myawaddy:
//      413.8 km raw).
//   2. Simplified the ~17,800 / ~5,700 raw points down to ~150 / ~100 with a
//      Douglas-Peucker algorithm, since the raw geometry is denser than this app's
//      inline-SVG map (MapView.tsx) can usefully render.
//   3. Snapped the original named checkpoint towns (Bago, Naypyidaw, Mandalay, ...) onto
//      their nearest point on the simplified path, so the driver's "Next: X - N km" card
//      and checkpoint-naming logic keep working against real road-following coordinates.
//
// Deliberately not queried at runtime: the whole point of this project is reliability
// under bad connectivity, so depending on a live third-party routing API — especially
// the public OSRM demo server, whose own terms say it isn't for production/demo-critical
// use — during the actual presentation would undermine that. See project_detail.md's
// "Live Demo Script" and this project's own README for the same reasoning applied to
// the map itself (inline SVG, no tile server).

export interface RouteWaypoint {
  /** Non-null only at named checkpoint towns; null for the in-between road-shape points. */
  name: string | null;
  lat: number;
  lng: number;
  /** Cumulative distance from the route's origin, via Haversine sum along the simplified path. */
  distanceFromOriginKm: number;
}

export const NORTHERN_CORRIDOR: RouteWaypoint[] = [
  { name: "Yangon (Hlaing Tharyar Depot)", lat: 16.8409, lng: 96.1735, distanceFromOriginKm: 0.0 },
  { name: null, lat: 16.8841, lng: 96.1548, distanceFromOriginKm: 5.2 },
  { name: null, lat: 16.9087, lng: 96.1663, distanceFromOriginKm: 8.2 },
  { name: null, lat: 16.9938, lng: 96.1440, distanceFromOriginKm: 18.0 },
  { name: null, lat: 17.0655, lng: 96.1664, distanceFromOriginKm: 26.3 },
  { name: null, lat: 17.2342, lng: 96.4613, distanceFromOriginKm: 62.8 },
  { name: null, lat: 17.2607, lng: 96.4712, distanceFromOriginKm: 65.9 },
  { name: "Bago", lat: 17.3182, lng: 96.4665, distanceFromOriginKm: 72.3 },
  { name: null, lat: 17.3581, lng: 96.5082, distanceFromOriginKm: 78.6 },
  { name: null, lat: 17.4546, lng: 96.5315, distanceFromOriginKm: 89.6 },
  { name: null, lat: 17.5089, lng: 96.5307, distanceFromOriginKm: 95.6 },
  { name: null, lat: 17.5653, lng: 96.5455, distanceFromOriginKm: 102.1 },
  { name: null, lat: 17.6001, lng: 96.5683, distanceFromOriginKm: 106.7 },
  { name: null, lat: 17.6899, lng: 96.5858, distanceFromOriginKm: 116.8 },
  { name: null, lat: 17.8761, lng: 96.7166, distanceFromOriginKm: 141.7 },
  { name: null, lat: 17.9557, lng: 96.7240, distanceFromOriginKm: 150.6 },
  { name: null, lat: 17.9572, lng: 96.7139, distanceFromOriginKm: 151.7 },
  { name: null, lat: 18.0612, lng: 96.6692, distanceFromOriginKm: 164.2 },
  { name: null, lat: 18.1266, lng: 96.6180, distanceFromOriginKm: 173.3 },
  { name: null, lat: 18.1592, lng: 96.6098, distanceFromOriginKm: 177.0 },
  { name: null, lat: 18.1860, lng: 96.5913, distanceFromOriginKm: 180.5 },
  { name: null, lat: 18.1860, lng: 96.5751, distanceFromOriginKm: 182.3 },
  { name: null, lat: 18.2011, lng: 96.5622, distanceFromOriginKm: 184.4 },
  { name: null, lat: 18.2297, lng: 96.5640, distanceFromOriginKm: 187.6 },
  { name: null, lat: 18.2477, lng: 96.5351, distanceFromOriginKm: 191.3 },
  { name: null, lat: 18.4567, lng: 96.4369, distanceFromOriginKm: 216.7 },
  { name: null, lat: 18.7693, lng: 96.4063, distanceFromOriginKm: 251.6 },
  { name: null, lat: 18.8804, lng: 96.4226, distanceFromOriginKm: 264.1 },
  { name: null, lat: 18.9014, lng: 96.4296, distanceFromOriginKm: 266.5 },
  { name: null, lat: 18.9080, lng: 96.4456, distanceFromOriginKm: 268.4 },
  { name: null, lat: 18.9532, lng: 96.4424, distanceFromOriginKm: 273.4 },
  { name: null, lat: 18.9757, lng: 96.4125, distanceFromOriginKm: 277.4 },
  { name: null, lat: 19.0384, lng: 96.3671, distanceFromOriginKm: 285.9 },
  { name: null, lat: 19.1589, lng: 96.3459, distanceFromOriginKm: 299.5 },
  { name: null, lat: 19.2319, lng: 96.2845, distanceFromOriginKm: 309.8 },
  { name: null, lat: 19.3032, lng: 96.2900, distanceFromOriginKm: 317.8 },
  { name: null, lat: 19.3557, lng: 96.2607, distanceFromOriginKm: 324.4 },
  { name: null, lat: 19.4653, lng: 96.2707, distanceFromOriginKm: 336.6 },
  { name: null, lat: 19.5821, lng: 96.2402, distanceFromOriginKm: 350.0 },
  { name: null, lat: 19.6167, lng: 96.2517, distanceFromOriginKm: 354.0 },
  { name: "Naypyidaw", lat: 19.7485, lng: 96.2322, distanceFromOriginKm: 368.8 },
  { name: null, lat: 19.7806, lng: 96.2607, distanceFromOriginKm: 373.5 },
  { name: null, lat: 19.8142, lng: 96.2656, distanceFromOriginKm: 377.2 },
  { name: null, lat: 19.8519, lng: 96.2606, distanceFromOriginKm: 381.5 },
  { name: null, lat: 19.8884, lng: 96.2399, distanceFromOriginKm: 386.1 },
  { name: null, lat: 19.9544, lng: 96.2545, distanceFromOriginKm: 393.6 },
  { name: null, lat: 20.0358, lng: 96.2458, distanceFromOriginKm: 402.7 },
  { name: null, lat: 20.0753, lng: 96.2586, distanceFromOriginKm: 407.2 },
  { name: null, lat: 20.1481, lng: 96.1932, distanceFromOriginKm: 417.8 },
  { name: null, lat: 20.2759, lng: 96.1789, distanceFromOriginKm: 432.1 },
  { name: null, lat: 20.3216, lng: 96.1576, distanceFromOriginKm: 437.7 },
  { name: null, lat: 20.3493, lng: 96.1635, distanceFromOriginKm: 440.8 },
  { name: null, lat: 20.4434, lng: 96.1345, distanceFromOriginKm: 451.7 },
  { name: null, lat: 20.5087, lng: 96.0737, distanceFromOriginKm: 461.3 },
  { name: null, lat: 20.5573, lng: 96.0652, distanceFromOriginKm: 466.8 },
  { name: null, lat: 20.6513, lng: 96.0210, distanceFromOriginKm: 478.2 },
  { name: null, lat: 20.6959, lng: 95.9833, distanceFromOriginKm: 484.6 },
  { name: null, lat: 20.7107, lng: 95.9412, distanceFromOriginKm: 489.2 },
  { name: null, lat: 20.7692, lng: 95.9002, distanceFromOriginKm: 497.0 },
  { name: null, lat: 20.8566, lng: 95.9573, distanceFromOriginKm: 508.4 },
  { name: null, lat: 20.9659, lng: 95.9631, distanceFromOriginKm: 520.6 },
  { name: null, lat: 21.0069, lng: 95.9891, distanceFromOriginKm: 525.9 },
  { name: null, lat: 21.0819, lng: 96.0090, distanceFromOriginKm: 534.5 },
  { name: null, lat: 21.0941, lng: 96.0270, distanceFromOriginKm: 536.8 },
  { name: null, lat: 21.2477, lng: 96.0236, distanceFromOriginKm: 553.9 },
  { name: null, lat: 21.2928, lng: 96.0087, distanceFromOriginKm: 559.1 },
  { name: null, lat: 21.3261, lng: 96.0285, distanceFromOriginKm: 563.3 },
  { name: null, lat: 21.3612, lng: 96.1630, distanceFromOriginKm: 577.8 },
  { name: null, lat: 21.4141, lng: 96.1866, distanceFromOriginKm: 584.2 },
  { name: null, lat: 21.5019, lng: 96.1828, distanceFromOriginKm: 593.9 },
  { name: null, lat: 21.5936, lng: 96.1375, distanceFromOriginKm: 605.2 },
  { name: null, lat: 21.7489, lng: 96.1067, distanceFromOriginKm: 622.7 },
  { name: null, lat: 21.7835, lng: 96.0745, distanceFromOriginKm: 627.8 },
  { name: null, lat: 21.8266, lng: 96.0623, distanceFromOriginKm: 632.8 },
  { name: "Mandalay", lat: 21.8543, lng: 96.0862, distanceFromOriginKm: 636.7 },
  { name: null, lat: 21.8508, lng: 96.1243, distanceFromOriginKm: 640.7 },
  { name: null, lat: 21.8806, lng: 96.2199, distanceFromOriginKm: 651.1 },
  { name: null, lat: 21.8772, lng: 96.2366, distanceFromOriginKm: 652.8 },
  { name: null, lat: 21.8360, lng: 96.2737, distanceFromOriginKm: 658.8 },
  { name: null, lat: 21.8513, lng: 96.2848, distanceFromOriginKm: 660.9 },
  { name: null, lat: 21.8590, lng: 96.3510, distanceFromOriginKm: 667.7 },
  { name: null, lat: 21.9141, lng: 96.3647, distanceFromOriginKm: 674.0 },
  { name: "Pyin Oo Lwin", lat: 22.0112, lng: 96.4402, distanceFromOriginKm: 687.3 },
  { name: null, lat: 22.0421, lng: 96.5035, distanceFromOriginKm: 694.7 },
  { name: null, lat: 22.0606, lng: 96.5171, distanceFromOriginKm: 697.2 },
  { name: null, lat: 22.0581, lng: 96.5548, distanceFromOriginKm: 701.1 },
  { name: null, lat: 22.0693, lng: 96.5777, distanceFromOriginKm: 703.8 },
  { name: null, lat: 22.1515, lng: 96.6117, distanceFromOriginKm: 713.6 },
  { name: "Nawnghkio Inspection Point", lat: 22.1978, lng: 96.6579, distanceFromOriginKm: 720.6 },
  { name: null, lat: 22.2802, lng: 96.6913, distanceFromOriginKm: 730.4 },
  { name: null, lat: 22.3446, lng: 96.8151, distanceFromOriginKm: 745.0 },
  { name: null, lat: 22.3412, lng: 96.8281, distanceFromOriginKm: 746.4 },
  { name: null, lat: 22.3545, lng: 96.8369, distanceFromOriginKm: 748.1 },
  { name: null, lat: 22.3703, lng: 96.8288, distanceFromOriginKm: 750.0 },
  { name: null, lat: 22.3533, lng: 96.8422, distanceFromOriginKm: 752.4 },
  { name: null, lat: 22.3593, lng: 96.9117, distanceFromOriginKm: 759.6 },
  { name: null, lat: 22.3783, lng: 96.9167, distanceFromOriginKm: 761.7 },
  { name: null, lat: 22.4155, lng: 96.9584, distanceFromOriginKm: 767.7 },
  { name: null, lat: 22.4709, lng: 96.9676, distanceFromOriginKm: 773.9 },
  { name: "Kyaukme Inspection Station", lat: 22.5118, lng: 97.0317, distanceFromOriginKm: 781.9 },
  { name: null, lat: 22.5406, lng: 97.0562, distanceFromOriginKm: 786.0 },
  { name: null, lat: 22.5342, lng: 97.0864, distanceFromOriginKm: 789.2 },
  { name: null, lat: 22.5476, lng: 97.1054, distanceFromOriginKm: 791.6 },
  { name: null, lat: 22.5476, lng: 97.1670, distanceFromOriginKm: 798.0 },
  { name: null, lat: 22.5603, lng: 97.1736, distanceFromOriginKm: 799.5 },
  { name: null, lat: 22.5691, lng: 97.2242, distanceFromOriginKm: 804.8 },
  { name: null, lat: 22.6180, lng: 97.2818, distanceFromOriginKm: 812.8 },
  { name: "Hsipaw", lat: 22.6153, lng: 97.3042, distanceFromOriginKm: 815.2 },
  { name: null, lat: 22.6040, lng: 97.3071, distanceFromOriginKm: 816.5 },
  { name: null, lat: 22.6277, lng: 97.3463, distanceFromOriginKm: 821.3 },
  { name: null, lat: 22.6110, lng: 97.3810, distanceFromOriginKm: 825.3 },
  { name: null, lat: 22.6367, lng: 97.4271, distanceFromOriginKm: 830.8 },
  { name: null, lat: 22.6374, lng: 97.4623, distanceFromOriginKm: 834.4 },
  { name: null, lat: 22.7035, lng: 97.5386, distanceFromOriginKm: 845.2 },
  { name: null, lat: 22.7074, lng: 97.5632, distanceFromOriginKm: 847.7 },
  { name: null, lat: 22.7261, lng: 97.5727, distanceFromOriginKm: 850.0 },
  { name: null, lat: 22.7461, lng: 97.6184, distanceFromOriginKm: 855.2 },
  { name: null, lat: 22.7751, lng: 97.6483, distanceFromOriginKm: 859.7 },
  { name: null, lat: 22.8971, lng: 97.7063, distanceFromOriginKm: 874.5 },
  { name: null, lat: 22.9435, lng: 97.6886, distanceFromOriginKm: 879.9 },
  { name: "Lashio", lat: 22.9581, lng: 97.7049, distanceFromOriginKm: 882.3 },
  { name: null, lat: 22.9849, lng: 97.7068, distanceFromOriginKm: 885.3 },
  { name: null, lat: 23.0251, lng: 97.7490, distanceFromOriginKm: 891.5 },
  { name: null, lat: 23.0598, lng: 97.7590, distanceFromOriginKm: 895.5 },
  { name: null, lat: 23.1119, lng: 97.8328, distanceFromOriginKm: 905.0 },
  { name: null, lat: 23.3249, lng: 97.9799, distanceFromOriginKm: 933.0 },
  { name: null, lat: 23.3275, lng: 97.9589, distanceFromOriginKm: 935.2 },
  { name: null, lat: 23.3537, lng: 97.9433, distanceFromOriginKm: 938.5 },
  { name: null, lat: 23.3640, lng: 97.9543, distanceFromOriginKm: 940.1 },
  { name: null, lat: 23.3826, lng: 97.9419, distanceFromOriginKm: 942.5 },
  { name: null, lat: 23.4360, lng: 97.9430, distanceFromOriginKm: 948.5 },
  { name: null, lat: 23.5002, lng: 97.9088, distanceFromOriginKm: 956.4 },
  { name: null, lat: 23.5434, lng: 97.9130, distanceFromOriginKm: 961.3 },
  { name: null, lat: 23.5510, lng: 97.9068, distanceFromOriginKm: 962.3 },
  { name: null, lat: 23.5434, lng: 97.8946, distanceFromOriginKm: 963.8 },
  { name: null, lat: 23.5690, lng: 97.8712, distanceFromOriginKm: 967.5 },
  { name: null, lat: 23.5568, lng: 97.8252, distanceFromOriginKm: 972.4 },
  { name: null, lat: 23.5820, lng: 97.8104, distanceFromOriginKm: 975.6 },
  { name: null, lat: 23.6997, lng: 97.8326, distanceFromOriginKm: 988.9 },
  { name: null, lat: 23.7741, lng: 97.9056, distanceFromOriginKm: 1000.0 },
  { name: null, lat: 23.8307, lng: 97.9395, distanceFromOriginKm: 1007.2 },
  { name: null, lat: 23.8701, lng: 97.9937, distanceFromOriginKm: 1014.2 },
  { name: null, lat: 23.9434, lng: 97.9960, distanceFromOriginKm: 1022.3 },
  { name: null, lat: 23.9487, lng: 97.9841, distanceFromOriginKm: 1023.7 },
  { name: null, lat: 23.9897, lng: 97.9773, distanceFromOriginKm: 1028.3 },
  { name: null, lat: 24.0031, lng: 97.9568, distanceFromOriginKm: 1030.9 },
  { name: null, lat: 24.0022, lng: 97.9257, distanceFromOriginKm: 1034.0 },
  { name: null, lat: 23.9911, lng: 97.9106, distanceFromOriginKm: 1036.0 },
  { name: "Muse (105-Mile Border Trade Zone)", lat: 23.9834, lng: 97.9167, distanceFromOriginKm: 1037.1 },
];

export const EASTERN_CORRIDOR: RouteWaypoint[] = [
  { name: "Yangon (Hlaing Tharyar Depot)", lat: 16.8409, lng: 96.1735, distanceFromOriginKm: 0.0 },
  { name: null, lat: 16.8841, lng: 96.1548, distanceFromOriginKm: 5.2 },
  { name: null, lat: 16.9087, lng: 96.1663, distanceFromOriginKm: 8.2 },
  { name: null, lat: 16.9400, lng: 96.1519, distanceFromOriginKm: 12.0 },
  { name: null, lat: 16.9938, lng: 96.1440, distanceFromOriginKm: 18.0 },
  { name: null, lat: 17.0174, lng: 96.1464, distanceFromOriginKm: 20.7 },
  { name: null, lat: 17.0655, lng: 96.1664, distanceFromOriginKm: 26.4 },
  { name: null, lat: 17.0876, lng: 96.1979, distanceFromOriginKm: 30.6 },
  { name: null, lat: 17.1072, lng: 96.2460, distanceFromOriginKm: 36.1 },
  { name: null, lat: 17.1283, lng: 96.2714, distanceFromOriginKm: 39.7 },
  { name: null, lat: 17.1896, lng: 96.3952, distanceFromOriginKm: 54.5 },
  { name: null, lat: 17.2166, lng: 96.4233, distanceFromOriginKm: 58.8 },
  { name: null, lat: 17.2335, lng: 96.4608, distanceFromOriginKm: 63.2 },
  { name: null, lat: 17.2607, lng: 96.4712, distanceFromOriginKm: 66.4 },
  { name: null, lat: 17.3182, lng: 96.4665, distanceFromOriginKm: 72.8 },
  { name: "Bago", lat: 17.3324, lng: 96.4729, distanceFromOriginKm: 74.5 },
  { name: null, lat: 17.3581, lng: 96.5082, distanceFromOriginKm: 79.2 },
  { name: null, lat: 17.4546, lng: 96.5315, distanceFromOriginKm: 90.2 },
  { name: null, lat: 17.4742, lng: 96.5275, distanceFromOriginKm: 92.5 },
  { name: null, lat: 17.4667, lng: 96.5842, distanceFromOriginKm: 98.6 },
  { name: null, lat: 17.4476, lng: 96.6264, distanceFromOriginKm: 103.5 },
  { name: null, lat: 17.4770, lng: 96.6818, distanceFromOriginKm: 110.2 },
  { name: null, lat: 17.4933, lng: 96.6856, distanceFromOriginKm: 112.1 },
  { name: null, lat: 17.5044, lng: 96.7095, distanceFromOriginKm: 114.9 },
  { name: null, lat: 17.5173, lng: 96.7167, distanceFromOriginKm: 116.5 },
  { name: null, lat: 17.5170, lng: 96.7713, distanceFromOriginKm: 122.3 },
  { name: null, lat: 17.5027, lng: 96.8052, distanceFromOriginKm: 126.2 },
  { name: null, lat: 17.4545, lng: 96.8621, distanceFromOriginKm: 134.3 },
  { name: null, lat: 17.4471, lng: 96.8923, distanceFromOriginKm: 137.6 },
  { name: null, lat: 17.4295, lng: 96.8924, distanceFromOriginKm: 139.6 },
  { name: null, lat: 17.4287, lng: 96.9241, distanceFromOriginKm: 143.0 },
  { name: null, lat: 17.4115, lng: 96.9656, distanceFromOriginKm: 147.8 },
  { name: null, lat: 17.3941, lng: 96.9849, distanceFromOriginKm: 150.6 },
  { name: null, lat: 17.3391, lng: 96.9987, distanceFromOriginKm: 156.9 },
  { name: null, lat: 17.3320, lng: 97.0304, distanceFromOriginKm: 160.3 },
  { name: null, lat: 17.3129, lng: 97.0389, distanceFromOriginKm: 162.6 },
  { name: null, lat: 17.2924, lng: 97.0840, distanceFromOriginKm: 167.9 },
  { name: null, lat: 17.2899, lng: 97.1078, distanceFromOriginKm: 170.5 },
  { name: null, lat: 17.2742, lng: 97.1200, distanceFromOriginKm: 172.6 },
  { name: null, lat: 17.2799, lng: 97.1356, distanceFromOriginKm: 174.4 },
  { name: null, lat: 17.2268, lng: 97.1811, distanceFromOriginKm: 182.0 },
  { name: null, lat: 17.2100, lng: 97.2109, distanceFromOriginKm: 185.7 },
  { name: null, lat: 17.2053, lng: 97.2454, distanceFromOriginKm: 189.4 },
  { name: null, lat: 17.1842, lng: 97.2765, distanceFromOriginKm: 193.5 },
  { name: null, lat: 17.1708, lng: 97.2868, distanceFromOriginKm: 195.3 },
  { name: null, lat: 17.1197, lng: 97.3000, distanceFromOriginKm: 201.2 },
  { name: null, lat: 17.0513, lng: 97.3069, distanceFromOriginKm: 208.8 },
  { name: null, lat: 17.0193, lng: 97.3337, distanceFromOriginKm: 213.4 },
  { name: null, lat: 16.9879, lng: 97.3464, distanceFromOriginKm: 217.1 },
  { name: null, lat: 16.9424, lng: 97.3495, distanceFromOriginKm: 222.2 },
  { name: null, lat: 16.9128, lng: 97.3701, distanceFromOriginKm: 226.1 },
  { name: null, lat: 16.9132, lng: 97.4057, distanceFromOriginKm: 229.9 },
  { name: null, lat: 16.9515, lng: 97.4144, distanceFromOriginKm: 234.3 },
  { name: null, lat: 16.9813, lng: 97.4405, distanceFromOriginKm: 238.6 },
  { name: null, lat: 16.9599, lng: 97.4830, distanceFromOriginKm: 243.7 },
  { name: null, lat: 16.9666, lng: 97.5208, distanceFromOriginKm: 247.8 },
  { name: null, lat: 16.9002, lng: 97.5867, distanceFromOriginKm: 258.0 },
  { name: "Hpa-An", lat: 16.8884, lng: 97.6109, distanceFromOriginKm: 260.9 },
  { name: null, lat: 16.8723, lng: 97.6040, distanceFromOriginKm: 262.8 },
  { name: null, lat: 16.8438, lng: 97.6072, distanceFromOriginKm: 266.0 },
  { name: null, lat: 16.8331, lng: 97.6266, distanceFromOriginKm: 268.4 },
  { name: null, lat: 16.8520, lng: 97.6600, distanceFromOriginKm: 272.5 },
  { name: null, lat: 16.8514, lng: 97.6780, distanceFromOriginKm: 274.4 },
  { name: null, lat: 16.7988, lng: 97.7232, distanceFromOriginKm: 282.0 },
  { name: null, lat: 16.7913, lng: 97.7489, distanceFromOriginKm: 284.8 },
  { name: null, lat: 16.7671, lng: 97.7521, distanceFromOriginKm: 287.6 },
  { name: null, lat: 16.7491, lng: 97.7769, distanceFromOriginKm: 290.9 },
  { name: null, lat: 16.7469, lng: 97.8094, distanceFromOriginKm: 294.3 },
  { name: null, lat: 16.7219, lng: 97.8312, distanceFromOriginKm: 298.0 },
  { name: null, lat: 16.7159, lng: 97.8618, distanceFromOriginKm: 301.3 },
  { name: null, lat: 16.7326, lng: 97.8847, distanceFromOriginKm: 304.3 },
  { name: null, lat: 16.7073, lng: 97.9266, distanceFromOriginKm: 309.6 },
  { name: null, lat: 16.6806, lng: 97.9520, distanceFromOriginKm: 313.6 },
  { name: null, lat: 16.6365, lng: 97.9589, distanceFromOriginKm: 318.6 },
  { name: null, lat: 16.6262, lng: 97.9492, distanceFromOriginKm: 320.1 },
  { name: null, lat: 16.6139, lng: 97.9677, distanceFromOriginKm: 322.5 },
  { name: null, lat: 16.5956, lng: 98.0457, distanceFromOriginKm: 331.1 },
  { name: null, lat: 16.5844, lng: 98.0597, distanceFromOriginKm: 333.0 },
  { name: null, lat: 16.5810, lng: 98.0833, distanceFromOriginKm: 335.6 },
  { name: "Kawkareik", lat: 16.5473, lng: 98.1571, distanceFromOriginKm: 344.3 },
  { name: null, lat: 16.5526, lng: 98.1752, distanceFromOriginKm: 346.3 },
  { name: null, lat: 16.5420, lng: 98.2026, distanceFromOriginKm: 349.5 },
  { name: null, lat: 16.5437, lng: 98.2261, distanceFromOriginKm: 352.0 },
  { name: null, lat: 16.5555, lng: 98.2717, distanceFromOriginKm: 357.0 },
  { name: null, lat: 16.5707, lng: 98.2840, distanceFromOriginKm: 359.1 },
  { name: null, lat: 16.5758, lng: 98.3092, distanceFromOriginKm: 361.9 },
  { name: null, lat: 16.5940, lng: 98.3356, distanceFromOriginKm: 365.4 },
  { name: "Dawna Range Pass", lat: 16.6773, lng: 98.3683, distanceFromOriginKm: 375.2 },
  { name: null, lat: 16.6899, lng: 98.3851, distanceFromOriginKm: 377.5 },
  { name: null, lat: 16.6971, lng: 98.4099, distanceFromOriginKm: 380.3 },
  { name: null, lat: 16.6891, lng: 98.4389, distanceFromOriginKm: 383.5 },
  { name: null, lat: 16.6935, lng: 98.4621, distanceFromOriginKm: 386.0 },
  { name: null, lat: 16.6851, lng: 98.4790, distanceFromOriginKm: 388.0 },
  { name: null, lat: 16.6876, lng: 98.5085, distanceFromOriginKm: 391.2 },
  { name: null, lat: 16.6981, lng: 98.5312, distanceFromOriginKm: 393.9 },
  { name: null, lat: 16.6838, lng: 98.5398, distanceFromOriginKm: 395.7 },
  { name: null, lat: 16.6752, lng: 98.5305, distanceFromOriginKm: 397.1 },
  { name: "Myawaddy (Thailand Friendship Bridge)", lat: 16.6830, lng: 98.5331, distanceFromOriginKm: 398.0 },
];

export const CORRIDORS = {
  "Northern (China)": NORTHERN_CORRIDOR,
  "Eastern (Thailand)": EASTERN_CORRIDOR,
} as const;

export type CorridorName = keyof typeof CORRIDORS;

/** Total route length — the denominator for progress-to-distance conversions below. */
export function routeTotalKm(route: RouteWaypoint[]): number {
  return route[route.length - 1]?.distanceFromOriginKm ?? 0;
}

/**
 * Interpolate a lat/lng position along a route at progress 0..1, proportional to
 * cumulative DISTANCE (not point index). With real road geometry, points are packed
 * densely on curvy sections and sparse on straight highway stretches — interpolating by
 * index fraction would make the truck marker visibly speed up and slow down for no
 * reason. Distance-based interpolation keeps its apparent speed uniform.
 */
export function positionAlongRoute(route: RouteWaypoint[], progress: number): { lat: number; lng: number } {
  if (route.length === 0) return { lat: 0, lng: 0 };
  const clamped = Math.max(0, Math.min(1, progress));
  const totalKm = routeTotalKm(route);
  const targetKm = clamped * totalKm;

  let i = 0;
  while (i < route.length - 2 && route[i + 1].distanceFromOriginKm < targetKm) i++;
  const a = route[i];
  const b = route[Math.min(i + 1, route.length - 1)];
  const segKm = b.distanceFromOriginKm - a.distanceFromOriginKm;
  const segT = segKm > 0 ? (targetKm - a.distanceFromOriginKm) / segKm : 0;

  return {
    lat: a.lat + (b.lat - a.lat) * segT,
    lng: a.lng + (b.lng - a.lng) * segT,
  };
}

/** Find the next upcoming NAMED checkpoint given current progress, for the driver's "Next: X - N km" card. */
export function nextWaypoint(route: RouteWaypoint[], progress: number): RouteWaypoint | null {
  const clamped = Math.max(0, Math.min(1, progress));
  const targetKm = clamped * routeTotalKm(route);
  return route.find((w) => w.name !== null && w.distanceFromOriginKm >= targetKm) ?? route[route.length - 1] ?? null;
}
