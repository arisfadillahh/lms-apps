import { getAccessibleLessonsForCoder } from "./src/lib/services/coder";

async function run() {
    try {
        const result = await getAccessibleLessonsForCoder("6ea8ec46-a496-4191-8da1-56272559fdde"); // Khansa
        console.dir(result, { depth: null });
    } catch (e) {
        console.error(e);
    }
}
run();
