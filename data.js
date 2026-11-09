/*
 * Budapest nyilvános WC-k
 *
 * hours    – ahogy a forrásban szerepel (ezt látja a felhasználó)
 * schedule – gép által olvasható nyitvatartás, ebből számolja az app, hogy most nyitva van-e
 *   "24h"                         egész nap nyitva
 *   "closed"                      tartósan zárva
 *   null                          nincs adat
 *   { all: [6, 18] }              minden nap 6:00–18:00
 *   { summer: [8, 20], winter: [7, 19] }   nyári (máj–szept) / téli (okt–ápr) nyitvatartás
 *   { days: { 0: null, 1: [7, 16], ... } } naponként (0 = vasárnap, 6 = szombat), null = zárva
 * Az órák lehetnek törtek is (pl. 7.5 = 7:30), a 24 éjfélt jelent.
 */
window.TOILETS = [
  { id: 1,  name: "Déli pályaudvar", address: "1012 Budapest, Krisztina krt. (Déli pályaudvar aluljáró kerengő)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "igen", lat: 47.5001, lng: 19.0242, district: 1 },
  { id: 2,  name: "Batthyány tér", address: "1011 Budapest, Batthyány tér (aluljáróban)", hours: "6-22", schedule: { all: [6, 22] }, price: "250 Ft", accessibility: "nem", lat: 47.5067, lng: 19.0388, district: 1 },
  { id: 3,  name: "Halászbástya", address: "1014 Budapest, Tárnok u. 15.", hours: "7-22", schedule: { all: [7, 22] }, price: "250 Ft", accessibility: "igen", lat: 47.5021, lng: 19.0346, district: 1 },
  { id: 4,  name: "Margit híd, budai hídfő", address: "1027 Budapest, Árpád fejedelem útja (Margit híd budai hídfő, aluljáró)", hours: "Nyári: 6-18, téli: 6-22", schedule: { summer: [6, 18], winter: [6, 22] }, price: "250 Ft", accessibility: "igen", lat: 47.5130, lng: 19.0395, district: 2 },
  { id: 5,  name: "Újpest, Szent István tér", address: "1042 Budapest, József Attila u. 56.", hours: "7-19", schedule: { all: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.5608, lng: 19.0880, district: 4 },
  { id: 6,  name: "Újpest-Városkapu", address: "1043 Budapest, Berda József utca (Újpest-Városkapu metró)", hours: "6-22", schedule: { all: [6, 22] }, price: "250 Ft", accessibility: "igen", lat: 47.5457, lng: 19.0703, district: 4 },
  { id: 7,  name: "Deák tér", address: "1052 Budapest, Károly körút (Károly krt. – Bárczy I. u. sarok)", hours: "7-19", schedule: { all: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.4977, lng: 19.0552, district: 5 },
  { id: 8,  name: "Astoria", address: "1052 Budapest, Károly körút 4.", hours: "Zárva", schedule: "closed", price: "250 Ft", accessibility: "nem", lat: 47.4936, lng: 19.0604, district: 5 },
  { id: 9,  name: "Petőfi tér", address: "1052 Budapest, Petőfi tér 3.", hours: "Téli: 7-19, nyári: 8-20", schedule: { summer: [8, 20], winter: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.4924, lng: 19.0507, district: 5 },
  { id: 10, name: "Jókai tér", address: "1061 Budapest, Jókai tér", hours: "0-24", schedule: "24h", price: "200 Ft", accessibility: "igen", lat: 47.5048, lng: 19.0625, district: 6 },
  { id: 11, name: "Lövölde tér", address: "1068 Budapest, Lövölde tér", hours: "Május–szeptember: 7–22, október–április: 7–21", schedule: { summer: [7, 22], winter: [7, 21] }, price: "200 Ft", accessibility: "nem", lat: 47.5066, lng: 19.0730, district: 6 },
  { id: 12, name: "Almássy tér", address: "1074 Budapest, Almássy tér", hours: "8-18", schedule: { all: [8, 18] }, price: "ingyenes", accessibility: "igen", lat: 47.5005, lng: 19.0715, district: 7 },
  { id: 13, name: "Klauzál tér", address: "1072 Budapest, Klauzál tér", hours: "8-18", schedule: { all: [8, 18] }, price: "ingyenes", accessibility: "igen (férfi oldal)", lat: 47.4983, lng: 19.0636, district: 7 },
  { id: 14, name: "Bethlen Gábor tér", address: "1074 Budapest, Bethlen Gábor tér", hours: "0-24", schedule: "24h", price: "250 Ft", accessibility: "igen", lat: 47.5020, lng: 19.0780, district: 7 },
  { id: 15, name: "Blaha Lujza tér", address: "1072 Budapest, Blaha Lujza tér", hours: "0-24", schedule: "24h", price: "250 Ft", accessibility: "igen", lat: 47.4963, lng: 19.0706, district: 7 },
  { id: 16, name: "Nagyvárad tér", address: "1089 Budapest, Nagyvárad tér (aluljáró)", hours: "7-19", schedule: { all: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.4785, lng: 19.0912, district: 8 },
  { id: 17, name: "Corvin-negyed", address: "1082 Budapest, József körút (Corvin-negyed aluljáró)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "nem", lat: 47.4860, lng: 19.0710, district: 8 },
  { id: 18, name: "Horváth Mihály tér", address: "1082 Budapest, Horváth Mihály tér", hours: "7-23", schedule: { all: [7, 23] }, price: "10 Ft", accessibility: "igen", lat: 47.4889, lng: 19.0717, district: 8 },
  { id: 19, name: "Losonci tér", address: "1085 Budapest, Losonci tér", hours: "7-23", schedule: { all: [7, 23] }, price: "10 Ft", accessibility: "igen", lat: 47.4848, lng: 19.0793, district: 8 },
  { id: 20, name: "Teleki téri piac", address: "1086 Budapest, Teleki László tér 11.", hours: "H: 7-16; K–P: 7-17; Szo: 6-14; V: zárva", schedule: { days: { 0: null, 1: [7, 16], 2: [7, 17], 3: [7, 17], 4: [7, 17], 5: [7, 17], 6: [6, 14] } }, price: "ingyenes", accessibility: "folyamatban (közbeszerzés alatt)", lat: 47.4927, lng: 19.0848, district: 8 },
  { id: 21, name: "Mátyás tér", address: "1081 Budapest, Mátyás tér 8.", hours: "0-24", schedule: "24h", price: "250 Ft", accessibility: "igen", lat: 47.4918, lng: 19.0768, district: 8 },
  { id: 22, name: "Orczy tér (mobil WC)", address: "1086 Budapest, Orczy tér (villamos- és buszmegálló sarok)", hours: "0-24", schedule: "24h", price: "ingyenes", accessibility: "nem", lat: 47.4876, lng: 19.0890, district: 8 },
  { id: 23, name: "Keleti pályaudvar", address: "1087 Budapest, Baross tér", hours: "n.a.", schedule: null, price: "250 Ft", accessibility: "nem", lat: 47.5003, lng: 19.0838, district: 8 },
  { id: 24, name: "Boráros tér", address: "1095 Budapest, Boráros tér (aluljáró)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "nem", lat: 47.4818, lng: 19.0657, district: 9 },
  { id: 25, name: "Népliget", address: "Budapest, Könyves Kálmán körút (Népliget aluljáró)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "nem", lat: 47.4757, lng: 19.0987, district: 9 },
  { id: 26, name: "Móricz Zsigmond körtér", address: "1117 Budapest, Móricz Zsigmond körtér (aluljáró)", hours: "7-19", schedule: { all: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.4774, lng: 19.0466, district: 11 },
  { id: 27, name: "Margitsziget, Fősétány", address: "1138 Budapest, Margitsziget, Fősétány", hours: "Téli: 7-19, nyári: 8-20", schedule: { summer: [8, 20], winter: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.5262, lng: 19.0476, district: 13 },
  { id: 28, name: "Margitsziget, Víztorony", address: "1138 Budapest, Margitsziget, a Szabadtéri Színpad mellett", hours: "Téli: 7-19, nyári: 8-20", schedule: { summer: [8, 20], winter: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.5283, lng: 19.0488, district: 13 },
  { id: 29, name: "Árpád híd", address: "1138 Budapest, Róbert Károly körút (Árpád híd metró, aluljáró)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "nem", lat: 47.5414, lng: 19.0676, district: 13 },
  { id: 30, name: "Lehel tér (automata)", address: "1134 Budapest, Váci út (Lehel tér aluljáró)", hours: "0-24", schedule: "24h", price: "250 Ft", accessibility: "igen", lat: 47.5180, lng: 19.0625, district: 13 },
  { id: 31, name: "Nyugati tér", address: "1132 Budapest, Nyugati tér (aluljáróban)", hours: "6-22", schedule: { all: [6, 22] }, price: "n.a.", accessibility: "nem", lat: 47.5103, lng: 19.0565, district: 13 },
  { id: 32, name: "Örs vezér tere", address: "1148 Budapest, Örs vezér tere (a Sugár mellett)", hours: "6-18", schedule: { all: [6, 18] }, price: "250 Ft", accessibility: "nem", lat: 47.5035, lng: 19.1365, district: 14 },
  { id: 33, name: "Széchenyi fürdő", address: "1146 Budapest, Hermina út 26–32. (a Széchenyi fürdő mellett)", hours: "Téli: 7-19, nyári: 8-19", schedule: { summer: [8, 19], winter: [7, 19] }, price: "250 Ft", accessibility: "nem", lat: 47.5187, lng: 19.0817, district: 14 },
  { id: 34, name: "Széll Kálmán tér", address: "1024 Budapest, Széll Kálmán tér", hours: "6-22", schedule: { all: [6, 22] }, price: "200 Ft", accessibility: "nem", lat: 47.5075, lng: 19.0240, district: 2 }
];
