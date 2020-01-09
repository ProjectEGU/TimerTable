import jsonpickle

with open("course_data_utm_20199", "r") as f:
    all_crs = jsonpickle.loads(f.read())

def has_tuesday_timeslot(lec_info):
    return any([ts['weekday'] == 'TU' for ts in lec_info['timeslots']])

def has_prof(prof_name, lec_secs):
    # [[print(instructor) for instructor in sec['instructors']] for sec in lec_secs]
    return any([prof_name.lower() in sec['instructors'].lower() for sec in lec_secs])

for crs in all_crs:
    if(crs['course_code'][8] == 'S'):
        lec_secs = []
        for sectype in ('LEC','PRA','TUT'):
            if sectype in crs['course_sections']:
                lec_secs += crs['course_sections'][sectype]
            
        if has_prof("ikh", lec_secs):
            print("---------------------------------------")
            print()
            print("{0}".format(crs['course_code']))
"""
for crs in all_crs:
    if '[24L]' in crs['course_info'] and crs['course_code'][3] in ('1', '2', '3') and crs['course_code'][8] == 'S':
        lec_secs = crs['course_sections']['LEC']
        if any(has_tuesday_timeslot(lec_info) for lec_info in lec_secs):
            print("---------------------------------------")
            print()
            print("{0}: {1} / {2} ({3})".format(crs['course_code'], 
                                                lec_secs[0]['enrolled_count'],
                                                lec_secs[0]['total_count'],
                                                lec_secs[0]['waitlist_count']))
            print(crs['course_info'])
"""