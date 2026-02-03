import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";


const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect
        (`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST: $
        {connectionInstance.Connection.host}`);
        // app.on("error", (error) => {
        //     console.log("ERROR: ",error);
        //     throw error
        // })

        // app.listen(process.env.PORT, () => {
        //     console.log(`App is listening on port ${process.env.PORT}`)
        // })

    } catch (error) {
        console.error(" MONGODB connection Error:",error);
        process.exit(1)
    }
}

export default connectDB