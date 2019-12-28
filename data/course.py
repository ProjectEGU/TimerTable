from time import strptime, strftime, time
import itertools

sectypes = ('LEC', 'TUT', 'PRA')
section_type_name = {'PRA': "Practicals", "TUT": "Tutorials", "LEC": "Lectures"}
tt_time_format = "%H:%M"
disp_time_format = "%I.%M%p"


def fmt_time(t):
    return strftime(disp_time_format, t).lstrip('0').rstrip('M')


class Course:
    def __init__(self, course_code, course_name, course_info, enrl_controls, term, course_sections_dict):
        self.course_code = course_code
        self.course_name = course_name
        self.course_info = course_info
        self.term = term
        self.enrl_controls = enrl_controls
        self.course_sections = course_sections_dict


class SingleSection:
    """
    Example:
        LEC101   Sanders, T. | Barac, V.   441/450 (0)
            TH 17:00-19:00 DH2020
            FR 12:00-15:00 IB120
    """

    def __init__(self, section_id, instructors_list, notes, enrolled_count, total_count, waitlist_count, timeslots):
        self.section_id = section_id
        self.instructors = ' | '.join(instructors_list) if instructors_list is not None else ""
        self.instructors_list = instructors_list
        self.notes = notes
        self.enrolled_count = int(enrolled_count)
        self.total_count = int(total_count)
        self.waitlist_count = int(waitlist_count)
        self.timeslots = timeslots
        self.is_closed = "Closed" in self.notes


class Timeslot:
    """
    Example:
        TH 17:00-19:00 DH2020

        Assumed start_time and end_time are in HH:MM 24-hour format.
        room_name_1 is used if term is F or S.
        room_name_2 is also used if term is Y.

        If term is F or S, then room_name_2 has unpredictable value.
    """

    def __init__(self, weekday, start_time, end_time, room_name_1, room_name_2):
        self.weekday = weekday
        self.start_time = [int(x) for x in start_time.strip().split(':')]
        self.end_time = [int(x) for x in end_time.strip().split(':')]
        self.room_name_1 = room_name_1 if room_name_1 is not None else ""
        self.room_name_2 = room_name_2 if room_name_2 is not None else ""

    def is_conflict(self, other):
        """
        This timeslot does not conflict with the other if:
            - this timeslot starts and ends before or right as the other timeslot starts
            - this timeslot starts and ends after or right as the other timeslot ends
        """
        if self.term != other.term:
            return False

        if self.weekday != other.weekday:
            return False

        # if self.start_time <= other.start_time and self.end_time <= other.start_time:
        if all(a <= b for a, b in zip(self.start_time, other.start_time)) and all(a <= b for a, b in zip(self.end_time, other.start_time)):
            return False

        # if self.start_time >= other.end_time and self.end_time >= other.end_time:
        if all(a >= b for a, b in zip(self.start_time, other.end_time)) and all(a <= b for a, b in zip(self.end_time, other.end_time)):
            return False

        return True
