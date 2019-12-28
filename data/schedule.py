from time import strptime, strftime, time
from copy import deepcopy
from course import *

n_weekday = 5

weekday_tt = {
    'MO': 0,
    'TU': 1,
    'WE': 2,
    'TH': 3,
    'FR': 4
}

weekday_disp = {
    0: 'MON',
    1: 'TUE',
    2: 'WED',
    3: 'THU',
    4: 'FRI'
}

class Schedule:
    def __init__(self):
        # LTP stands for LEC-TUT-PRA tuple.
        self.course_ltp_list = []

        # this is a list where each element is another list of (Course, SingleSection, TimeSlot) tuples, sorted by starting time.
        self.wk_sched_F = None
        self.wk_sched_S = None

    def make_copy(self):
        new_sched = Schedule()
        new_sched.course_ltp_list = list(self.course_ltp_list)
        #n ew_sched.wk_sched_F = list(self.wk_sched_F)
        # new_sched.wk_sched_S = list(self.wk_sched_S)
        return new_sched

    def add_course(self, course: Course, lec_sec, tut_sec=None, pra_sec=None):
        """
        csd = course.course_sections_dict

        assert(lec_sec_name in csd['LEC'])

        if tut_sec_name is not None:
            assert(tut_sec_name in csd['TUT'])
        else:
            assert('TUT' not in csd)

        if pra_sec_name is not None:
            assert(pra_sec_name in csd['PRA'])
        else:
            assert('PRA' not in csd)

        if(not self.check_add_course_sections(course, lec_sec_name, tut_sec_name, pra_sec_name)[0]):
            return False

        self.course_ltp_list.append((course, \
                                     course.get_section('LEC', lec_sec_name), \
                                     course.get_section('TUT', tut_sec_name), \
                                     course.get_section('PRA', pra_sec_name)))
        """
        self.course_ltp_list.append((course, lec_sec, tut_sec, pra_sec))
        return True

    def rm_course(self, course: Course):
        crs_idx = -1
        for i in range(len(self.course_ltp_list)):
            if self.course_ltp_list[i][0].course_code == course.course_code:
                crs_idx = i
                break

        if crs_idx == -1:
            return False
        else:
            self.course_ltp_list.pop(crs_idx)
            return True

    def check_add_course_sections(self, courseOther: Course, *sectionsOther, ignore_full_closed=False):
        """

        :param courseOther:
        :param sectionsOther:
        :return:
        """
        csd = courseOther.course_sections_dict

        s_out = courseOther.course_code + "\n"

        sectionConflictFound = False

        for secOther in filter(lambda s: s is not None, sectionsOther):
            s_this = ""
            s_this += secOther.to_string(indent_spaces=4, show_timeslots=False).split('\n')[0]
            if not ignore_full_closed:
                if not secOther.is_room():
                    s_this += "(full)"
                    sectionConflictFound = True
                elif secOther.is_closed():
                    s_this += "(closed)"
                    sectionConflictFound = True

            s_this += '\n'

            for slotOther in secOther.timeslots:
                s_this += slotOther.to_string(indent_spaces=8) + " "
                slotConflictFound = False
                for course_ltp in self.course_ltp_list:
                    courseThis = self.course_ltp_list[0][0]
                    for secThis in course_ltp[1:]:
                        if secThis is None:
                            continue

                        for slotThis in secThis.timeslots:
                            # slotThis, slotOther
                            if slotThis.is_conflict(slotOther):
                                s_this += "conflict with {0:<9} {1:<7} {2}".format(courseThis.course_code, secThis.section_id, slotThis.to_string())
                                slotConflictFound = True
                                break

                        if slotConflictFound:
                            break
                    if slotConflictFound:
                        break

                if not slotConflictFound:
                    s_this += '(no conflict)'
                else:
                    sectionConflictFound = True
                s_this += '\n'

            s_out += s_this

        s_out += "\n"

        return (not sectionConflictFound, s_out)


    def check_add_course(self, courseOther: Course):
        """
        A course can be added if there is a non-conflicting LEC section that is open.

        Cases of conflict:

        Any of below:
        1. All LEC sections are either conflict or full.
        2. All TUT sections are either conflict or full.
        3. All PRA sections are either conflict or full.

        Display conflict reason

        Open Spots:


        All Conflicted or Full:
        MAT324
            LEC102  60/60 (15)
                TH 17:00-19:00 DH2020    conflict with CSC324 LEC101 FR 5:00p - 7:00p
                FR 19:00-21:00 IB120
            TUT104 4:00p - 5:30p  15/60        conflict with CSC324 LEC101 5:00p - 7:00p


        Return the tuple of (is_conflict, report_string)
        """
        
        csd = courseOther.course_sections

        #assert("LEC" in csd)
        #assert(len(csd["LEC"]) > 0)

        conflic = { 'LEC': False, 'TUT': False, 'PRA': False }

        s_ok_secs = ""
        s_conflict_secs = ""

        for sectype in sectypes:
            if sectype in csd:
                secTypeAllConflicting = True
                for secOther in csd[sectype]:

                    s_this = ""
                    s_this += secOther.to_string(indent_spaces=4, show_timeslots=False, show_notes=False).split('\n')[0]

                    sectionConflictFound = False

                    if not secOther.is_room():
                        s_this += "(full)"
                        sectionConflictFound = True
                    elif secOther.is_closed():
                        s_this += "(closed)"
                        sectionConflictFound = True

                    s_this += '\n'
                    slotConflictFound = False
                    for slotOther in secOther.timeslots:
                        s_this += slotOther.to_string(indent_spaces=8) + " "

                        for course_ltp in self.course_ltp_list:
                            courseThis = course_ltp[0]
                            for secThis in course_ltp[1:]:
                                if secThis is None:
                                    continue
                                # secThis: part-of-schedule Section
                                # courseThis: part-of-schedule Course
                                # secOther: add-to-schedule Section
                                # courseOther: add-to-schedule Course
                                for slotThis in secThis.timeslots:
                                    # slotThis, slotOther
                                    if slotThis.is_conflict(slotOther):
                                        s_this += "conflict with {0:<9} {1:<7} {2}".format(courseThis.course_code, secThis.section_id, slotThis.to_string())
                                        slotConflictFound = True
                                        break

                                if slotConflictFound:
                                    break
                            if slotConflictFound:
                                break

                    if not slotConflictFound:
                        s_this += '(no conflict)'
                    else:
                        sectionConflictFound = True
                    s_this += '\n'

                if not sectionConflictFound:
                    secTypeAllConflicting = False
                    s_ok_secs += s_this
                else:
                    s_conflict_secs += s_this


                conflic[sectype] = secTypeAllConflicting

        s_out = courseOther.course_code + ": " + courseOther.course_name + "\n" + s_ok_secs + s_conflict_secs

        return ((not any(conflic[sec] for sec in sectypes)), s_out)


    def build_wcs_list(self):
        # this is a list where each element is another list of (Course, SingleSection, TimeSlot) tuples, sorted by section starting time.
        self.wk_sched_F = [list() for i in range(n_weekday)]
        self.wk_sched_S = [list() for i in range(n_weekday)]

        # parse ltp sections into list
        for course_ltp in self.course_ltp_list:
            course = course_ltp[0]
            for section in course_ltp[1:]:
                if section is None:
                    continue
                for timeslot in section.timeslots:
                    idx = weekday_tt[timeslot.weekday]
                    term = timeslot.term
                    if term == 'F':
                        self.wk_sched_F[idx].append((course, section, timeslot))
                    elif term == 'S':
                        self.wk_sched_S[idx].append((course, section, timeslot))


        # sort each day by start time
        for day in self.wk_sched_F:
            day.sort(key=lambda cst: cst[2].start_time)

        for day in self.wk_sched_S:
            day.sort(key=lambda cst: cst[2].start_time)

    def to_string(self, ltp_header=False):
        """
        MON
        2:00p - 3:00p    MAT404    LEC101    IB220    Vakar T. | Kumar S.
        3:00p - 5:00p    CSC414    TUT105    DH2020   George M.
        5:00p - 6:00p    Break
        6:00p - 7:00p    PHL204    LEC104    CC102    Frank J.

        TUE

        WED

        THU

        FRI
        """
        self.build_wcs_list()

        s_out = ""

        if ltp_header:
            s_temp = []
            for cltp in self.course_ltp_list:
                s_temp.append(" ".join([cltp[0].course_code] + [x.section_id for x in cltp[1:] if x is not None]))
            s_out += '\n'.join(set(s_temp))
            s_out += '\n'

        def appending(wk_sched):
            s_out2 = ""

            for w in range(n_weekday):
                s_out2 += weekday_disp[w] + '\n'

                for cst in wk_sched[w]:
                    course = cst[0]
                    section = cst[1]
                    timeslot = cst[2]

                    s_out2 += "{0}    {1:<10}{2:<10}{3:<10}{4}\n".format(
                        "{0:<17}".format(
                         fmt_time(timeslot.start_time) + " - " + fmt_time(timeslot.end_time)
                        ),
                                                                              course.course_code,
                                                                              section.section_id,
                                                                              timeslot.room_name,
                                                                              section.instructors)

                s_out2 += "\n"
            return s_out2

        s_out += "Fall term\n"
        s_out += appending(self.wk_sched_F)
        s_out += "Winter term\n"
        s_out += appending(self.wk_sched_S)

        return s_out

    def check_wcs_integrity(self):
        # check tht each course has appropriate Lec Tut Pra sections registered
        # check each course are non-conflicting
        pass


    """
                                if secOther.is_conflict(secThis):
                                    thisConflict = True
                                    s_conflict_secs += "    "
    """
