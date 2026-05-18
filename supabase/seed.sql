-- NarPulse — seed data
-- Realistic mock data for Nərimanov rayonu, Baku
-- Coordinate range: lat 40.395-40.420, lng 49.840-49.880
-- Run after 0001_init.sql

-- =========== OUTAGES ===========
insert into public.outages (utility, status, area_name, center_lat, center_lng, radius_m, started_at, estimated_end, source, description) values
  ('water', 'active', '8 Noyabr küç., 12-24 evlər', 40.4101, 49.8612, 350, now() - interval '1 hour 25 minutes', now() + interval '2 hours', 'azersu', 'Magistral xəttdə qəza təmiri. Su təchizatı müvəqqəti dayandırılıb.'),
  ('electricity', 'active', 'Ziya Bünyadov pr., metro yaxınlığı', 40.4053, 49.8587, 420, now() - interval '38 minutes', now() + interval '1 hour 20 minutes', 'azerisiq', 'Transformator yarımstansiyasında qəza. Briqada yerdədir.'),
  ('gas', 'active', 'Ağa Nemətulla küç., 18 saylı bina', 40.4012, 49.8551, 220, now() - interval '12 minutes', now() + interval '3 hours', 'socar', 'Qaz sızıntısı barəsində bildirim. Sahə blokiranır, ekspert briqadası yola düşüb.'),
  ('water', 'planned', 'Tələbə qəsəbəsi, 3-cü mikrorayon', 40.4163, 49.8688, 600, now() + interval '14 hours', now() + interval '20 hours', 'azersu', 'Planlı texniki iş. Sabah 08:00-14:00 arası su olmayacaq.'),
  ('electricity', 'resolved', 'Qara Qarayev m. ərazisi', 40.4022, 49.8731, 380, now() - interval '5 hours', now() - interval '2 hours', 'azerisiq', 'Elektrik şəbəkəsində nasazlıq. Bərpa edilib.'),
  ('water', 'resolved', '28 May küç.', 40.3987, 49.8451, 280, now() - interval '8 hours', now() - interval '4 hours', 'azersu', 'Boru zədəsi aradan qaldırıldı.');

update public.outages set resolved_at = now() - interval '2 hours' where area_name = 'Qara Qarayev m. ərazisi';
update public.outages set resolved_at = now() - interval '4 hours' where area_name = '28 May küç.';

-- =========== SERVICE LOCATIONS ===========
with l as (
  insert into public.service_locations (name, kind, lat, lng, address, opens_at, closes_at) values
    ('ASAN Xidmət Mərkəzi №1', 'asan', 40.4087, 49.8554, 'Nərimanov, Atatürk pr. 90', '09:00', '20:00'),
    ('Nərimanov Rayon İcra Hakimiyyəti', 'rih', 40.4068, 49.8612, 'Nərimanov, Ağa Nemətulla 4', '09:00', '18:00'),
    ('1 saylı Şəhər Poliklinikası', 'poliklinika', 40.4124, 49.8651, 'Nərimanov, 8 Noyabr 14', '08:00', '20:00'),
    ('3 saylı Poliklinika', 'poliklinika', 40.4045, 49.8702, 'Nərimanov, Ziya Bünyadov 32', '08:00', '20:00'),
    ('21 saylı Uşaq Poliklinikası', 'poliklinika', 40.4002, 49.8489, 'Nərimanov, Bakıxanov 8', '08:00', '19:00'),
    ('Nərimanov Poçt Şöbəsi №1', 'post', 40.4061, 49.8595, 'Nərimanov, Ağa Nemətulla 12', '09:00', '18:00'),
    ('Nərimanov Poçt Şöbəsi №2', 'post', 40.4115, 49.8730, 'Nərimanov, Tələbə qəsəbəsi', '09:00', '18:00'),
    ('Kapital Bank — Nərimanov filialı', 'bank', 40.4076, 49.8580, 'Nərimanov, Atatürk pr. 78', '09:30', '17:30')
  returning id, name
)
select * from l;

-- =========== WAIT CHECK-INS (30 across last 4 hours) ===========
-- Build from service_locations by name
insert into public.wait_checkins (location_id, wait_minutes, reported_at)
select sl.id, wm, now() - (interval '1 minute' * mins_ago)
from (values
  ('ASAN Xidmət Mərkəzi №1', 8, 6),
  ('ASAN Xidmət Mərkəzi №1', 12, 18),
  ('ASAN Xidmət Mərkəzi №1', 10, 24),
  ('ASAN Xidmət Mərkəzi №1', 15, 41),
  ('ASAN Xidmət Mərkəzi №1', 22, 55),
  ('ASAN Xidmət Mərkəzi №1', 18, 72),
  ('ASAN Xidmət Mərkəzi №1', 25, 95),
  ('ASAN Xidmət Mərkəzi №1', 30, 140),
  ('1 saylı Şəhər Poliklinikası', 25, 4),
  ('1 saylı Şəhər Poliklinikası', 35, 19),
  ('1 saylı Şəhər Poliklinikası', 40, 38),
  ('1 saylı Şəhər Poliklinikası', 28, 67),
  ('1 saylı Şəhər Poliklinikası', 45, 110),
  ('3 saylı Poliklinika', 15, 9),
  ('3 saylı Poliklinika', 12, 22),
  ('3 saylı Poliklinika', 20, 48),
  ('3 saylı Poliklinika', 18, 84),
  ('21 saylı Uşaq Poliklinikası', 8, 11),
  ('21 saylı Uşaq Poliklinikası', 14, 33),
  ('21 saylı Uşaq Poliklinikası', 10, 70),
  ('Nərimanov Poçt Şöbəsi №1', 5, 7),
  ('Nərimanov Poçt Şöbəsi №1', 12, 26),
  ('Nərimanov Poçt Şöbəsi №1', 8, 51),
  ('Nərimanov Poçt Şöbəsi №2', 18, 14),
  ('Nərimanov Poçt Şöbəsi №2', 22, 39),
  ('Nərimanov Poçt Şöbəsi №2', 15, 88),
  ('Kapital Bank — Nərimanov filialı', 22, 5),
  ('Kapital Bank — Nərimanov filialı', 28, 28),
  ('Kapital Bank — Nərimanov filialı', 35, 62),
  ('Kapital Bank — Nərimanov filialı', 30, 105)
) as t(name, wm, mins_ago)
join public.service_locations sl on sl.name = t.name;

-- =========== SAFETY PINS ===========
insert into public.safety_pins (lat, lng, category, description, upvotes, status, created_at) values
  (40.4096, 49.8623, 'lighting', 'Atatürk prospektində bir neçə işıq dirəyi sönükdür, axşam saatlarında piyada keçidi qaranlıq qalır.', 14, 'pending', now() - interval '2 days'),
  (40.4042, 49.8589, 'crossing', 'Piyada keçidində xətlər tamamilə silinib, sürücülər görmür. Çox təhlükəlidir.', 22, 'pending', now() - interval '3 days'),
  (40.4127, 49.8665, 'traffic', 'İşıqfor xarabdır, axşamlar çox təhlükəlidir. Avtomobillər kəsişməni anlamadan keçir.', 31, 'reviewed', now() - interval '5 days'),
  (40.4011, 49.8513, 'sidewalk', 'Səki blokları sınıb, qoca qadın bu yaxınlarda büdrədi.', 7, 'pending', now() - interval '18 hours'),
  (40.4067, 49.8702, 'lighting', 'Həyət içində LED işıq lazımdır, tamamilə qaranlıqdır.', 11, 'pending', now() - interval '1 day'),
  (40.4153, 49.8718, 'crossing', 'Məktəb yaxınlığında piyada keçidi yoxdur, uşaqlar yolu xaotik şəkildə keçir.', 28, 'pending', now() - interval '4 days'),
  (40.3998, 49.8456, 'traffic', 'Tıxac problemi səhər 8:00-9:00 arası dəhşətlidir. Qovşaqda nizamlama lazımdır.', 9, 'pending', now() - interval '6 hours'),
  (40.4032, 49.8645, 'other', 'Açıq lyuk qapağı! Cəld bağlanmalıdır.', 19, 'resolved', now() - interval '10 days'),
  (40.4088, 49.8551, 'lighting', 'Park ərazisində gecə işıqlandırma yox dərəcəsindədir.', 6, 'pending', now() - interval '8 hours'),
  (40.4119, 49.8589, 'sidewalk', 'Səki dar və avtomobillər səkiyə çıxır, anaların əli arabalı kənardan keçməyə məcburdur.', 13, 'pending', now() - interval '2 days'),
  (40.4055, 49.8521, 'crossing', 'Piyada keçidində "yavaş" işarəsi yoxdur, sürücülər tam sürətlə keçir.', 4, 'pending', now() - interval '4 hours'),
  (40.4012, 49.8678, 'other', 'Zibil qutusu tam doludur, ətrafa səpələnir. Həm gözəgəlimsiz, həm sanitariya problemi.', 8, 'pending', now() - interval '14 hours');
