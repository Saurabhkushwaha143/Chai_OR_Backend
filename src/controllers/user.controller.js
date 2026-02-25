import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const genrateAccessAndRefreshToken = async(userId) =>
{
  try {
    const user = await User.findById(userId)
    if (!user) {
      throw new Error("User not found while generating tokens");
    }
    const accessToken = user.genrateAccessToken()
    const refreshToken = user.genrateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({validateBeforeSave: false})

    return {accessToken, refreshToken}

  } catch (error) {
    console.log("TOKEN ERROR:", error);
    throw new ApiError(500,"something went wrong while genrating referesh and access token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists: username, email
  // check for images, check for avtar
  // upload them to cloudinary, avtar
  // create user object - create entry in db
  // remove passward and refresh token feild from response
  // return response

  const { fullName, email, username, password } = req.body;
//   console.log("email: ", email);
  // console.log("req.files =>", req.files);
  // console.log("req.file =>", req.file);
  if (!fullName || !email || !username || !password) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username alredy exists");
  }

  console.log("BODY:", req.body);
  console.log("FILES:", req.files);

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath 
       ? await uploadOnCloudinary(coverImageLocalPath)
       : null;

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registring the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "user registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // take data from request body
  // validate by username or email 
  // find the user
  // password check
  // acccess and refresh token
  // send cookie


  
  console.log("BODY:", req.body);
  // console.log("Content-Type:", req.headers["content-type"]);
  const { username, email, password } = req.body || {};

  if(!(username || email)){
    throw new ApiError(400,"username or email is required")
  }

  const user = await User.findOne({
    $or: [{username}, {email}]
  })

  if(!user){
    throw new ApiError(404,"User does not exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)

  if(!isPasswordValid){
    throw new ApiError(401,"Incorrect Password")
  }

  const {accessToken, refreshToken} =  await genrateAccessAndRefreshToken(user._id)


  const loggedInUser = await User.findById(user._id).
  select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", refreshToken, options)
  .json(
    new ApiResponse(
      200,
      {
        user: loggedInUser, accessToken, refreshToken
      },
      "User loggedIn successfully"
    )
  )


})

const logoutUser = asyncHandler(async(req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }
  )

  const options = {
    httpOnly: true,
    secure: true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged Out"))

})

const refreshAccessToken = asyncHandler(async(req, res) => {

  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

  if(!refreshAccessToken){
    throw new ApiError(401,"unauthorized request")
  }

  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
    const user = await User.findById(decodedToken?._id)
  
    if(!user){
      throw new ApiError(401,"Invalid refresh Token")
    }
  
    if(incomingRefreshToken != user?.refreshToken){
      throw new ApiError(401,"Refresh token is expired or used")
    }
  
    const options = {
      httpOnly: true,
      secure: true
    }
  
    const {accessToken, newrefreshToken} = await genrateAccessAndRefreshToken(user._id)
  
    return res
    .status(200)
    .cookie("accessToken",accessToken, options)
    .cookie("refreshToken",newrefreshToken, options)
    .json(
      new ApiResponse(
        200,
        {accessToken, refreshToken: newrefreshToken},
        "Access token refreshed successfully"
      )
    )
  } catch (error) {
    throw new ApiError(401,error?.message || "Invalid refresh token")
  }

})

export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
 };
